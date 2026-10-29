import { NextResponse, type NextRequest } from "next/server";
import { trustedClientIp } from "@/lib/net/client-ip";
import {
  NO_STORE_HEADERS,
  exchangeAuthorizationCode,
  isOAuthEnabled,
  maybePruneOAuth,
  oauthCorsHeaders,
  rotateRefreshToken,
  tokenClientLimiter,
  tokenIpLimiter,
  type TokenResult,
} from "@/lib/oauth";
import { oauthErrorResponse, readTokenRequest } from "../responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Token endpoint: authorization_code (PKCE S256, single-use 60 s code) and
// refresh_token (rotation; a replayed refresh token revokes the whole grant).
// Public clients: client_id in the body or as the Basic username, no secret.
// Rate limits are in-process, so they still bite when Redis is down.
export async function POST(req: NextRequest) {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });

  const body = await readTokenRequest(req);
  if (!body) return oauthErrorResponse(400, "invalid_request", "Unreadable request body");
  const clientId = (body.get("client_id") ?? "").slice(0, 200);
  const grantType = body.get("grant_type") ?? "";

  const ip = trustedClientIp(req) ?? "unknown";
  const byIp = tokenIpLimiter.hit(ip);
  const byClient = tokenClientLimiter.hit(clientId || `anon:${ip}`);
  if (!byIp.ok || !byClient.ok) {
    console.warn(`[oauth/token] rate limited ip=${ip} client=${clientId.slice(0, 40)}`);
    return oauthErrorResponse(429, "slow_down", "Too many token requests. Retry later.", {
      "Retry-After": String(Math.max(byIp.retryAfterSec, byClient.retryAfterSec)),
    });
  }
  if (!clientId) return oauthErrorResponse(401, "invalid_client", "client_id is required");

  try {
    let result: TokenResult;
    if (grantType === "authorization_code") {
      const code = body.get("code") ?? "";
      const codeVerifier = body.get("code_verifier") ?? "";
      const redirectUri = body.get("redirect_uri") ?? "";
      if (!code || !codeVerifier || !redirectUri) {
        return oauthErrorResponse(
          400,
          "invalid_request",
          "code, code_verifier and redirect_uri are required"
        );
      }
      result = await exchangeAuthorizationCode({
        code,
        codeVerifier,
        clientId,
        redirectUri,
        resource: body.get("resource") || null,
      });
    } else if (grantType === "refresh_token") {
      const refreshToken = body.get("refresh_token") ?? "";
      if (!refreshToken) {
        return oauthErrorResponse(400, "invalid_request", "refresh_token is required");
      }
      result = await rotateRefreshToken({ refreshToken, clientId });
    } else {
      return oauthErrorResponse(
        400,
        "unsupported_grant_type",
        "Use authorization_code or refresh_token"
      );
    }

    maybePruneOAuth();
    if (!result.ok) {
      const status = result.error === "invalid_client" ? 401 : 400;
      return oauthErrorResponse(status, result.error, result.description);
    }
    return NextResponse.json(result.tokens, {
      headers: { ...oauthCorsHeaders(), ...NO_STORE_HEADERS },
    });
  } catch (err) {
    console.error("[oauth/token] failed:", err);
    return oauthErrorResponse(500, "server_error", "Token request failed");
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: oauthCorsHeaders() });
}
