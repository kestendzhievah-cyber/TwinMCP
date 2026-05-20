import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { jsonError, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { audit, auditCtxFromRequest } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  const rl = await checkAuthWriteLimit(session.userId, "key_revoke");
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    const response = jsonError(
      429,
      "Trop d'opérations sur tes clés API. Patiente un instant avant de réessayer.",
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
