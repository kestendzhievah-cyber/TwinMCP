import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, users, mcpServers, userServers } from "@/db/schema";
import { badRequest, forbidden, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { createServerSchema, slugify } from "@/lib/validation/platform";
import { assertServerQuota, QuotaExceededError } from "@/lib/quota";
import {
  isBoxSizeAllowed,
  minPlanForBoxSize,
  PlanRestrictionError,
  PLAN_LABELS,
} from "@/lib/plan-features";
import { logAudit, clientIp } from "@/lib/audit/log";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

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
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

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

    await assertServerQuota(session.userId, me.plan);

    // Box size is plan-gated (free: small, pro: +medium, team: all). Enforce
    // here — the Zod schema accepts any valid enum value, so without this a
    // free user could POST boxSize:"large" and provision an oversized box.
    const boxSize = parsed.data.boxSize ?? "small";
    if (!isBoxSizeAllowed(me.plan, boxSize)) {
      const required = minPlanForBoxSize(boxSize) ?? "team";
      throw new PlanRestrictionError(
        "box-size",
        required,
        `The ${boxSize} box size requires the ${PLAN_LABELS[required]} plan.`,
      );
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (!slug) return badRequest("Could not derive a slug from the name");

    const id = randomUUID();
    await db.insert(servers).values({
      id,
      userId: session.userId,
      name: parsed.data.name,
      slug,
      boxSize,
      region: parsed.data.region ?? null,
      status: "provisioning",
    });

    // Auto-install TwinMCP Docs (handled by control-plane proxy, no exec in box).
    // Best-effort: a missing CONFIG_ENCRYPTION_KEY or transient DB error must
    // not block server creation — the user can install MCPs manually later.
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

    logAudit({
      userId: session.userId,
      action: "server.create",
      targetType: "server",
      targetId: id,
      metadata: { slug, boxSize },
      ip: clientIp(req),
    });

    // Enqueue provisioning (queued via QStash in prod, inline in dev)
    await enqueue({ type: "provision-server", serverId: id }).catch((err) =>
      console.error(`[servers POST] enqueue provision ${id} failed:`, err)
    );

    return NextResponse.json({ id, slug, status: "provisioning" }, { status: 201 });
  } catch (err) {
    if (err instanceof QuotaExceededError || err instanceof PlanRestrictionError) {
      return forbidden(err.message);
    }
    if (err instanceof Error && /unique/i.test(err.message)) {
      return badRequest("Slug already in use for one of your servers");
    }
    console.error("[servers POST]", err);
    return serverError();
  }
}
