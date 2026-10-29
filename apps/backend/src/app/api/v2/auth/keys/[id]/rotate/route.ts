import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { clearAuthCache, generateApiKey } from "@/lib/auth";
import { isKeyUsable, rotationExpiry, ROTATION_OVERLAP_MS } from "@/lib/auth/key-scope";
import { jsonError, notFound, serverError } from "@/lib/errors";
import { requireKeyManager } from "@/lib/session";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { audit, auditCtxFromRequest } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rotation with an overlap window: mints a replacement with the same name,
 * scope and server binding, and schedules the old key to stop working 24 h
 * later (expires_at = now + 24 h) instead of killing it on the spot, so every
 * IDE config can be updated without an outage. The replaced key no longer
 * holds a plan slot (lib/auth/key-scope.ts countsTowardKeyLimit), so rotation
 * works at the limit. The new raw key is returned once, like on creation.
 * Need the old key dead now (a leak)? Revoke it: DELETE /api/v2/auth/keys/:id.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireKeyManager(req);
  if (session instanceof NextResponse) return session;

  const rl = await checkAuthWriteLimit(session.userId, "key_rotate");
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    const response = jsonError(
      429,
      "Too many API-key operations. Please wait a moment and try again.",
      { retryAfter }
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }

  const { id } = await params;

  try {
    const { raw, prefix, hash } = generateApiKey();
    const newId = randomUUID();
    const now = new Date();
    const oldKeyExpiresAt = rotationExpiry(now);

    const result = await getDb().transaction(async (tx) => {
      // Lock the row to the caller: an active key they own, or nothing.
      const [old] = await tx
        .select({
          name: apiKeys.name,
          scope: apiKeys.scope,
          serverId: apiKeys.serverId,
          revokedAt: apiKeys.revokedAt,
          expiresAt: apiKeys.expiresAt,
        })
        .from(apiKeys)
        .where(
          and(eq(apiKeys.id, id), eq(apiKeys.userId, session.userId), isNull(apiKeys.revokedAt))
        )
        .for("update")
        .limit(1);
      if (!old || !isKeyUsable(old, now.getTime())) return { kind: "missing" as const };
      // Already on its way out (a previous rotation): rotating it again would
      // mint a second replacement. Its replacement is the key to rotate.
      if (old.expiresAt) return { kind: "retiring" as const, expiresAt: old.expiresAt };

      await tx.update(apiKeys).set({ expiresAt: oldKeyExpiresAt }).where(eq(apiKeys.id, id));
      await tx.insert(apiKeys).values({
        id: newId,
        userId: session.userId,
        keyHash: hash,
        prefix,
        name: old.name,
        scope: old.scope,
        serverId: old.serverId,
      });
      return {
        kind: "ok" as const,
        name: old.name ?? null,
        scope: old.scope,
        serverId: old.serverId,
      };
    });
    if (result.kind === "missing") return notFound("Key not found");
    if (result.kind === "retiring") {
      return jsonError(
        409,
        `This key was already replaced and stops working at ${result.expiresAt.toISOString()}. Rotate its replacement instead, or revoke it to stop it now.`,
        { expiresAt: result.expiresAt.toISOString() }
      );
    }

    clearAuthCache(); // the old key's cached entry must pick up its new expiry
    const ctx = auditCtxFromRequest(req);
    audit({
      userId: session.userId,
      action: "api_key.rotate",
      targetType: "api_key",
      targetId: newId,
      ip: ctx.ip,
      metadata: {
        replacedKeyId: id,
        replacedKeyExpiresAt: oldKeyExpiresAt.toISOString(),
        prefix,
        name: result.name,
        scope: result.scope,
        serverId: result.serverId,
        userAgent: ctx.userAgent,
      },
    });
    return NextResponse.json(
      {
        id: newId,
        key: raw,
        prefix,
        name: result.name,
        scope: result.scope,
        serverId: result.serverId,
        replacedKeyId: id,
        oldKeyExpiresAt: oldKeyExpiresAt.toISOString(),
        overlapHours: ROTATION_OVERLAP_MS / 3_600_000,
        message: `New key created. The old key keeps working until ${oldKeyExpiresAt.toISOString()} (24 hours), then stops. Revoke it to stop it sooner.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[auth/keys rotate]", err);
    return serverError();
  }
}
