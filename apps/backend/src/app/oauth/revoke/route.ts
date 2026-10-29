import { NextResponse, type NextRequest } from "next/server";
import { trustedClientIp } from "@/lib/net/client-ip";
import {
  NO_STORE_HEADERS,
  isOAuthEnabled,
  oauthCorsHeaders,
  revokeByToken,
  tokenIpLimiter,
} from "@/lib/oauth";
import { oauthErrorResponse, readTokenRequest } from "../responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 7009 token revocation, for connectors that disconnect cleanly. Revoking
// either token of a grant revokes the whole grant. 200 for any well-formed
// request (an unknown token is not an error, §2.2). Users revoke from
// Settings → Connectors (/api/v2/oauth/connections/<id>).
export async function POST(req: NextRequest) {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });

  const ip = trustedClientIp(req) ?? "unknown";
  const rl = tokenIpLimiter.hit(ip);
  if (!rl.ok) {
    return oauthErrorResponse(429, "slow_down", "Too many requests. Retry later.", {
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  const body = await readTokenRequest(req);
  const token = body?.get("token") ?? "";
  const clientId = body?.get("client_id") ?? "";
  if (!token || !clientId) {
    return oauthErrorResponse(400, "invalid_request", "token and client_id are required");
  }
  try {
    await revokeByToken(token, clientId);
  } catch (err) {
    console.error("[oauth/revoke] failed:", err);
    return oauthErrorResponse(500, "server_error", "Revocation failed");
  }
  return new NextResponse(null, {
    status: 200,
    headers: { ...oauthCorsHeaders(), ...NO_STORE_HEADERS },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: oauthCorsHeaders() });
}
