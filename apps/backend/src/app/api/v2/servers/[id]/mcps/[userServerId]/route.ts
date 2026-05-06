import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers, userServers } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import {
  assertServerOwnership,
  assertUserServerOwnership,
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/rbac";
import {
  updateUserServerSchema,
  configSchemaShape,
  validateConfigAgainstSchema,
  type ConfigSchemaShape,
} from "@/lib/validation/platform";
import { encryptConfig, decryptConfig } from "@/lib/crypto/config-encryption";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decryptIfPresent(
  ciphertext: string,
  iv: string,
  tag: string
): Record<string, unknown> {
  if (!ciphertext) return {};
  try {
    return decryptConfig<Record<string, unknown>>({ ciphertext, iv, tag });
  } catch (err) {
    console.error("[mcps] decrypt failed:", err);
    return {};
  }
}

function maskSecrets(
  config: Record<string, unknown>,
  schema: ConfigSchemaShape
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    const def = schema.properties?.[k];
    out[k] = def?.secret ? null : v;
  }
  return out;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userServerId: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id: serverId, userServerId } = await params;

  try {
    await assertServerOwnership(session.userId, serverId);
    const us = await assertUserServerOwnership(session.userId, userServerId);
    if (us.serverId !== serverId) return notFound("Installation not found on this server");

    const [mcp] = await getDb()
      .select({
        id: mcpServers.id,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
        runtime: mcpServers.runtime,
        version: mcpServers.version,
        configSchema: mcpServers.configSchema,
      })
      .from(mcpServers)
      .where(eq(mcpServers.id, us.mcpServerId))
      .limit(1);
    if (!mcp) return serverError("Catalog entry vanished");

    const schemaParse = configSchemaShape.safeParse(mcp.configSchema);
    const schema = schemaParse.success ? schemaParse.data : { properties: {} };
    const decrypted = decryptIfPresent(us.configCiphertext, us.configIv, us.configTag);
    const config = maskSecrets(decrypted, schema);

    return NextResponse.json({
      id: us.id,
      mcpServerId: us.mcpServerId,
      mcpSlug: mcp.slug,
      mcpName: mcp.name,
      mcpDescription: mcp.description,
      mcpRuntime: mcp.runtime,
      mcpVersion: mcp.version,
      configSchema: schema,
      config,
      enabled: us.enabled,
      installedAt: us.installedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[mcps/:id GET]", err);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userServerId: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id: serverId, userServerId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = updateUserServerSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertServerOwnership(session.userId, serverId);
    const us = await assertUserServerOwnership(session.userId, userServerId);
    if (us.serverId !== serverId) return notFound("Installation not found on this server");

    const patch: Record<string, unknown> = {};
    let action: "mcp.toggle" | "mcp.reconfigure" = "mcp.toggle";

    if (parsed.data.enabled !== undefined) {
      patch.enabled = parsed.data.enabled;
    }
    if (parsed.data.config !== undefined) {
      action = "mcp.reconfigure";
      const [mcp] = await getDb()
        .select({ configSchema: mcpServers.configSchema })
        .from(mcpServers)
        .where(eq(mcpServers.id, us.mcpServerId))
        .limit(1);
      if (!mcp) return serverError("Catalog entry vanished");
      const schemaParse = configSchemaShape.safeParse(mcp.configSchema);
      if (!schemaParse.success) return serverError("Catalog entry malformed");

      // Merge: keep existing values for keys not provided in the patch.
      const existing = decryptIfPresent(us.configCiphertext, us.configIv, us.configTag);
      const merged: Record<string, unknown> = { ...existing };
      for (const [k, v] of Object.entries(parsed.data.config)) {
        if (v === "" || v === null || v === undefined) continue;
        merged[k] = v;
      }

      const validation = validateConfigAgainstSchema(merged, schemaParse.data);
      if (!validation.ok) return badRequest(validation.error);
      const encrypted = encryptConfig(merged);
      patch.configCiphertext = encrypted.ciphertext;
      patch.configIv = encrypted.iv;
      patch.configTag = encrypted.tag;
    }

    await getDb().update(userServers).set(patch).where(eq(userServers.id, userServerId));

    logAudit({
      userId: session.userId,
      action,
      targetType: "user_server",
      targetId: userServerId,
      metadata: {
        serverId,
        fields: Object.keys(parsed.data),
        configKeys:
          parsed.data.config !== undefined ? Object.keys(parsed.data.config) : undefined,
      },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[mcps/:id PATCH]", err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userServerId: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id: serverId, userServerId } = await params;

  try {
    await assertServerOwnership(session.userId, serverId);
    const us = await assertUserServerOwnership(session.userId, userServerId);
    if (us.serverId !== serverId) return notFound("Installation not found on this server");

    await getDb()
      .delete(userServers)
      .where(and(eq(userServers.id, userServerId), eq(userServers.userId, session.userId)));

    logAudit({
      userId: session.userId,
      action: "mcp.uninstall",
      targetType: "user_server",
      targetId: userServerId,
      metadata: { serverId, mcpServerId: us.mcpServerId },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[mcps/:id DELETE]", err);
    return serverError();
  }
}
