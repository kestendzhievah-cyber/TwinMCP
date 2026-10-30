import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers, userServers } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import {
  installMcpSchema,
  configSchemaShape,
  validateConfigAgainstSchema,
} from "@/lib/validation/platform";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { logAudit, clientIp } from "@/lib/audit/log";
import { enqueue } from "@/lib/queue/qstash";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { trackServer } from "@/lib/analytics/server";
import { emitWebhookEvent } from "@/lib/webhooks/emit";
import { getEntitlements } from "@/lib/wallet/entitlements";
import { canUseMcpOnPromo, PROMO_LOCKED_MCP_MESSAGE } from "@/lib/wallet/eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id: serverId } = await params;

  try {
    await assertServerOwnership(session.userId, serverId);
    const rows = await getDb()
      .select({
        id: userServers.id,
        mcpServerId: userServers.mcpServerId,
        enabled: userServers.enabled,
        installedAt: userServers.installedAt,
        mcpSlug: mcpServers.slug,
        mcpName: mcpServers.name,
        mcpRuntime: mcpServers.runtime,
        mcpVersion: mcpServers.version,
      })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(eq(userServers.serverId, serverId));
    return NextResponse.json({ items: rows });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[servers/:id/mcps GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id: serverId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = installMcpSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const server = await assertServerOwnership(session.userId, serverId);

    const db = getDb();
    const [mcp] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, parsed.data.mcpServerId))
      .limit(1);
    if (!mcp) return notFound("MCP server not in catalog");
    if (!mcp.isPublic && mcp.publishedByUserId !== session.userId) {
      return notFound("MCP server not in catalog");
    }

    // A tool's host mode must match the server: "local" tools (e.g. Blender) run
    // on the user's machine via the agent and only fit local_agent servers; box
    // tools only fit box servers.
    const isLocal = server.hostType === "local_agent";
    if (isLocal !== (mcp.hostMode === "local")) {
      return badRequest(
        isLocal
          ? "This tool runs in a cloud box — install it on a standard server, not a local-agent one."
          : "This tool runs locally via the agent — install it on a local-agent server."
      );
    }

    // Promo-only accounts (wallet never funded: running on the sign-up credit)
    // cannot install the MCPs that turn a box into a general-purpose computer
    // (shell, code interpreter, headless browser): free credit must not buy
    // arbitrary compute. Checked only for those MCPs, so a normal install
    // costs no extra query.
    if (!canUseMcpOnPromo(mcp.slug, { startCmd: mcp.startCmd, isOfficial: mcp.isOfficial })) {
      // Wallet-derived (funded_at or a live paying legacy subscription), never
      // users.plan. A missing user row is treated as promo-only (fail closed).
      const me = await getEntitlements(session.userId);
      if (!me || me.promoOnly) {
        return forbidden(PROMO_LOCKED_MCP_MESSAGE);
      }
    }

    // Capacity guard: every box-hosted MCP runs at once, so too many OOM the box
    // (and flip the whole server to `error`). twinmcp-docs runs on the control
    // plane, so it doesn't count against the box. Local-agent tools run on the
    // user's machine — no box to OOM — so the cap doesn't apply.
    if (!isLocal && mcp.slug !== TWINMCP_DOCS_SLUG) {
      const cap = maxMcpsForBoxSize(server.boxSize);
      const [tally] = await db
        .select({ n: count() })
        .from(userServers)
        .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
        .where(
          and(
            eq(userServers.serverId, serverId),
            eq(userServers.enabled, true),
            ne(mcpServers.slug, TWINMCP_DOCS_SLUG)
          )
        );
      if ((tally?.n ?? 0) >= cap) {
        return forbidden(
          `A ${server.boxSize} box can run up to ${cap} MCPs at once. Remove one, or create a server with a larger box.`
        );
      }
    }

    const schemaParse = configSchemaShape.safeParse(mcp.configSchema);
    if (!schemaParse.success) {
      console.error("[mcps POST] catalog entry has invalid configSchema", mcp.id);
      return serverError("Catalog entry is malformed");
    }
    const validation = validateConfigAgainstSchema(parsed.data.config, schemaParse.data);
    if (!validation.ok) return badRequest(validation.error);

    const encrypted = encryptConfig(parsed.data.config);
    const id = randomUUID();
    await db.insert(userServers).values({
      id,
      userId: session.userId,
      serverId,
      mcpServerId: mcp.id,
      configCiphertext: encrypted.ciphertext,
      configIv: encrypted.iv,
      configTag: encrypted.tag,
      enabled: true,
    });

    logAudit({
      userId: session.userId,
      action: "mcp.install",
      targetType: "user_server",
      targetId: id,
      metadata: { serverId, mcpServerId: mcp.id, slug: mcp.slug },
      ip: clientIp(req),
    });

    // Outbound webhook (fire-and-forget, never throws). Metadata only — never
    // the config values.
    emitWebhookEvent(session.userId, "mcp.installed", {
      serverId,
      serverSlug: server.slug,
      userServerId: id,
      mcpServerId: mcp.id,
      mcpSlug: mcp.slug,
      mcpName: mcp.name,
    });

    // Activation funnel (fire-and-forget; trackServer never throws).
    trackServer({
      event: "mcp_installed",
      distinctId: session.userId,
      properties: {
        mcpSlug: mcp.slug,
        serverId,
        hostMode: mcp.hostMode,
        isOfficial: mcp.isOfficial,
        configKeys: Object.keys(parsed.data.config).length,
      },
    });

    // Box tools install into the box (no-op if not running yet). Local-agent
    // tools need no box job — the running agent picks them up on its next sync.
    if (!isLocal) {
      await enqueue({ type: "install-mcp", userServerId: id }).catch((err) =>
        console.error(`[mcps POST] enqueue install ${id} failed:`, err)
      );
    }

    return NextResponse.json({ id, mcpServerId: mcp.id }, { status: 201 });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    if (err instanceof Error && /unique/i.test(err.message)) {
      return badRequest("This MCP is already installed on this server");
    }
    console.error("[servers/:id/mcps POST]", err);
    return serverError();
  }
}
