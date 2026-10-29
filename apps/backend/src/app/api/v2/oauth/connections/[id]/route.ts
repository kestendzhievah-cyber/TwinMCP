import { NextResponse, type NextRequest } from "next/server";
import { requireManagementUser } from "@/lib/session";
import { jsonError, notFound, serverError } from "@/lib/errors";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { trustedClientIp } from "@/lib/net/client-ip";
import { oauthAudit, revokeFamily } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/v2/oauth/connections/:id — revoke a connector's grant (every
 * access and refresh token of the family). Immediate: the in-process token
 * cache is cleared, so the next MCP call from that connector gets a 401.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  const rl = await checkAuthWriteLimit(session.userId, "oauth_revoke");
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return jsonError(
      429,
      "Too many operations. Please wait a moment and try again.",
      { retryAfter },
      { "Retry-After": String(retryAfter) }
    );
  }

  const { id } = await params;
  if (!UUID.test(id)) return notFound("Connector not found");
  try {
    const revoked = await revokeFamily(id, session.userId);
    if (!revoked) return notFound("Connector not found");
    oauthAudit(
      session.userId,
      "oauth.revoke",
      id,
      { by: "user", userAgent: req.headers.get("user-agent") },
      trustedClientIp(req)
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oauth/connections DELETE]", err);
    return serverError();
  }
}
