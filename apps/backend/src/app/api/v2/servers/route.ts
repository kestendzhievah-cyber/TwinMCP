import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, users, mcpServers, userServers } from "@/db/schema";
import { badRequest, creditRequired, forbidden, serverError, unauthorized } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { createServerSchema, slugify } from "@/lib/validation/platform";
import { assertServerQuota, QuotaExceededError } from "@/lib/quota";
import {
  can,
  isBoxSizeAllowed,
  minPlanFor,
  minPlanForBoxSize,
  PlanRestrictionError,
  PLAN_CAPABILITIES,
  requiredTierMessage,
} from "@/lib/plan-features";
import { logAudit, clientIp } from "@/lib/audit/log";
import {
  TWINMCP_DOCS_SLUG,
  TOPUP_URL,
  assertComputeAllowed,
  isInsufficientCreditError,
} from "@/lib/provisioning";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";
import { trackServer } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which surface created the server, for the activation funnel. The body has
 * no such field, so read it off the Referer: /onboarding → "onboarding",
 * anything else (the dashboard, a script) → "dashboard".
 */
function creationSource(req: NextRequest): "dashboard" | "onboarding" {
  const referer = req.headers.get("referer") ?? "";
  try {
    return new URL(referer).pathname.startsWith("/onboarding") ? "onboarding" : "dashboard";
  } catch {
    return "dashboard";
  }
}

export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const rows = await getDb()
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        hostType: servers.hostType,
        boxSize: servers.boxSize,
        region: servers.region,
        endpointUrl: servers.endpointUrl,
        status: servers.status,
        lastHeartbeatAt: servers.lastHeartbeatAt,
        createdAt: servers.createdAt,
      })
      .from(servers)
      .where(eq(servers.userId, session.userId))
      .orderBy(desc(servers.createdAt));
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("[servers GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const db = getDb();
    const [me] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!me) return unauthorized("User not found");

    // Every server runs on the prepaid wallet: no credit (or promotional credit
    // past its compute cap), no new server. Fails CLOSED on a database error.
    try {
      await assertComputeAllowed(session.userId);
    } catch (err) {
      if (isInsufficientCreditError(err)) {
        return creditRequired(
          err.reason === "no_credit"
            ? `Your TwinMCP credit is used up. Top up at ${TOPUP_URL} to create a server.`
            : err.message
        );
      }
      throw err;
    }

    // "free" (Free credit, wallet never funded): 1 server, small box only.
    // "pro" (Pay as you go, funded): 50 servers, every size.
    await assertServerQuota(session.userId, me.plan);

    // "local_agent" servers host no box — the user runs `ctx7 connect` and the
    // control plane relays to their machine. They skip box provisioning, sizing,
    // and region selection, and start `stopped` (offline) until an agent attaches.
    const hostType = parsed.data.hostType ?? "upstash_box";
    const isLocal = hostType === "local_agent";

    // Box size is tier-gated (Free credit: small only; Pay as you go and Team:
    // every size). Enforce here — the Zod schema accepts any valid enum value,
    // so without this an unfunded account could POST boxSize:"large".
    const boxSize = parsed.data.boxSize ?? "small";
    if (!isLocal && !isBoxSizeAllowed(me.plan, boxSize)) {
      const required = minPlanForBoxSize(boxSize) ?? "team";
      throw new PlanRestrictionError(
        "box-size",
        required,
        requiredTierMessage(required, `The ${boxSize} box size`)
      );
    }

    // Region selection is a Team capability — don't let lower plans pin a region.
    if (!isLocal && parsed.data.region !== undefined && !can(me.plan, "regionSelection")) {
      const required = minPlanFor("regionSelection");
      throw new PlanRestrictionError(
        "region-selection",
        required,
        requiredTierMessage(required, "Choosing a deployment region")
      );
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!slug) return badRequest("Could not derive a slug from the name");

    const initialStatus = isLocal ? "stopped" : "provisioning";
    const id = randomUUID();
    await db.insert(servers).values({
      id,
      userId: session.userId,
      name: parsed.data.name,
      slug,
      hostType,
      boxSize,
      region: isLocal ? null : (parsed.data.region ?? null),
      status: initialStatus,
    });

    // Box servers auto-install TwinMCP Docs (control-plane proxy, no exec in box)
    // and enqueue provisioning. Local-agent servers do neither — they host only
    // the local tools the user installs, and come online when `ctx7 connect` runs.
    // Best-effort: a missing CONFIG_ENCRYPTION_KEY or transient DB error must not
    // block server creation — the user can install MCPs manually later.
    if (!isLocal) {
      const [docsMcp] = await db
        .select({ id: mcpServers.id })
        .from(mcpServers)
        .where(eq(mcpServers.slug, TWINMCP_DOCS_SLUG))
        .limit(1);
      if (docsMcp) {
        try {
          const empty = encryptConfig({});
          await db.insert(userServers).values({
            id: randomUUID(),
            userId: session.userId,
            serverId: id,
            mcpServerId: docsMcp.id,
            configCiphertext: empty.ciphertext,
            configIv: empty.iv,
            configTag: empty.tag,
            enabled: true,
          });
        } catch (autoInstallErr) {
          console.warn(
            `[servers POST] auto-install of ${TWINMCP_DOCS_SLUG} skipped:`,
            autoInstallErr instanceof Error ? autoInstallErr.message : autoInstallErr
          );
        }
      } else {
        console.warn(`[servers POST] ${TWINMCP_DOCS_SLUG} not in catalog — run pnpm seed:mcps`);
      }
    }

    logAudit({
      userId: session.userId,
      action: "server.create",
      targetType: "server",
      targetId: id,
      metadata: { slug, hostType, ...(isLocal ? {} : { boxSize }) },
      ip: clientIp(req),
    });

    // Activation funnel (fire-and-forget; trackServer never throws).
    trackServer({
      event: "server_created",
      distinctId: session.userId,
      properties: {
        serverId: id,
        hostType,
        boxSize: isLocal ? null : boxSize,
        plan: me.plan,
        source: creationSource(req),
      },
    });

    if (!isLocal) {
      // Enqueue provisioning (queued via QStash in prod, inline in dev)
      await enqueue({ type: "provision-server", serverId: id }).catch((err) =>
        console.error(`[servers POST] enqueue provision ${id} failed:`, err)
      );
    }

    return NextResponse.json({ id, slug, status: initialStatus }, { status: 201 });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      const funded = PLAN_CAPABILITIES.pro.servers;
      return forbidden(
        err.limit < funded
          ? `Free credit accounts run ${err.limit} server${err.limit === 1 ? "" : "s"}. Top up your TwinMCP credit to run up to ${funded}.`
          : `You already run ${err.limit} servers, the most an account can. Delete one to create another.`
      );
    }
    if (err instanceof PlanRestrictionError) return forbidden(err.message);
    if (err instanceof Error && /unique/i.test(err.message)) {
      return badRequest("Slug already in use for one of your servers");
    }
    console.error("[servers POST]", err);
    return serverError();
  }
}
