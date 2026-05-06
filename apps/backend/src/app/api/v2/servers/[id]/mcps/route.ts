import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers, userServers } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import {
  assertServerOwnership,
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/rbac";
import {
  installMcpSchema,
  configSchemaShape,
  validateConfigAgainstSchema,
} from "@/lib/validation/platform";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { logAudit, clientIp } from "@/lib/audit/log";
import { enqueue } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
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
    await assertServerOwnership(session.userId, serverId);

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

    // Enqueue install in box (no-op if server isn't running yet)
    await enqueue({ type: "install-mcp", userServerId: id }).catch((err) =>
      console.error(`[mcps POST] enqueue install ${id} failed:`, err)
    );

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
