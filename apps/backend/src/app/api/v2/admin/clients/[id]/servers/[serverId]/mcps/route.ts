import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, mcpServers, userServers } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import {
  installMcpSchema,
  configSchemaShape,
  validateConfigAgainstSchema,
} from "@/lib/validation/platform";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";
import { logAudit, clientIp } from "@/lib/audit/log";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin installs a catalog MCP onto a CLIENT's server. Mirrors the self-serve
// install (host-mode match, box capacity, config-schema validation, encrypted
// config, enqueue), but the ownership check is "server belongs to this client"
// rather than "to the caller", and it's audited with the acting admin.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id: clientId, serverId } = await params;
  const db = getDb();

  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server || server.userId !== clientId) return notFound("Serveur introuvable pour ce client");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = installMcpSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const [mcp] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, parsed.data.mcpServerId))
      .limit(1);
    if (!mcp) return notFound("MCP absent du catalogue");

    const isLocal = server.hostType === "local_agent";
    if (isLocal !== (mcp.hostMode === "local")) {
      return badRequest(
        isLocal
          ? "Ce MCP tourne dans une box cloud — installez-le sur un serveur standard."
          : "Ce MCP tourne localement via l'agent — il ne peut pas aller sur une box."
      );
    }

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
          `Une box ${server.boxSize} accepte jusqu'à ${cap} MCPs. Retirez-en un, ou créez un serveur avec une box plus grande.`
        );
      }
    }

    const schemaParse = configSchemaShape.safeParse(mcp.configSchema);
    if (!schemaParse.success) return serverError("Entrée catalogue malformée");
    const validation = validateConfigAgainstSchema(parsed.data.config, schemaParse.data);
    if (!validation.ok) return badRequest(validation.error);

    const encrypted = encryptConfig(parsed.data.config);
    const id = randomUUID();
    await db.insert(userServers).values({
      id,
      userId: clientId,
      serverId,
      mcpServerId: mcp.id,
      configCiphertext: encrypted.ciphertext,
      configIv: encrypted.iv,
      configTag: encrypted.tag,
      enabled: true,
    });

    logAudit({
      userId: clientId,
      action: "admin.mcp.install",
      targetType: "user_server",
      targetId: id,
      metadata: { serverId, mcpServerId: mcp.id, slug: mcp.slug, actorAdminId: admin.userId },
      ip: clientIp(req),
    });

    if (!isLocal) {
      await enqueue({ type: "install-mcp", userServerId: id }).catch((err) =>
        console.error(`[admin mcp install] enqueue install ${id} failed:`, err)
      );
    }

    return NextResponse.json({ id, mcpServerId: mcp.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      return badRequest("Ce MCP est déjà installé sur ce serveur.");
    }
    console.error("[admin mcp install]", err);
    return serverError();
  }
}
