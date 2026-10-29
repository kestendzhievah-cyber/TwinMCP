import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { clearAuthCache } from "@/lib/auth";
import { jsonError, notFound, serverError } from "@/lib/errors";
import { requireKeyManager } from "@/lib/session";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { audit, auditCtxFromRequest } from "@/lib/audit";
import { dropAgentsForKey } from "@/lib/agent/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Revoke is immediate, including for a replaced key still in its rotation
// overlap (unlike rotate, which leaves the old key working for 24 h).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireKeyManager(req);
  if (session instanceof NextResponse) return session;

  const rl = await checkAuthWriteLimit(session.userId, "key_revoke");
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
    const result = await getDb()
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.userId)))
      .returning({ id: apiKeys.id });
    if (result.length === 0) return notFound("Key not found");
    clearAuthCache(); // a revoked key must stop working immediately
    dropAgentsForKey(id); // …including a local-agent link it holds open
    {
      const ctx = auditCtxFromRequest(req);
      audit({
        userId: session.userId,
        action: "api_key.revoke",
        targetType: "api_key",
        targetId: id,
        ip: ctx.ip,
        metadata: { userAgent: ctx.userAgent },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/keys DELETE]", err);
    return serverError();
  }
}
