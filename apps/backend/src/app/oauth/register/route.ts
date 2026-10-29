import { NextResponse, type NextRequest } from "next/server";
import { trustedClientIp } from "@/lib/net/client-ip";
import {
  NO_STORE_HEADERS,
  OAUTH_SCOPE,
  isOAuthEnabled,
  maybePruneOAuth,
  oauthCorsHeaders,
  registerClient,
  registerIpLimiter,
  validateRegistration,
} from "@/lib/oauth";
import { oauthErrorResponse } from "../responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 7591 dynamic client registration. Unauthenticated by design (MCP
// connectors register themselves): public clients only, redirect URIs
// validated (https, loopback http, Cursor / VS Code schemes), rate-limited
// per IP, and registrations that never obtain a token are pruned after a day.
export async function POST(req: NextRequest) {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });

  const ip = trustedClientIp(req) ?? "unknown";
  const rl = registerIpLimiter.hit(ip);
  if (!rl.ok) {
    console.warn(`[oauth/register] rate limited ip=${ip}`);
    return oauthErrorResponse(429, "slow_down", "Too many registrations. Retry later.", {
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return oauthErrorResponse(400, "invalid_client_metadata", "Body must be a JSON object");
  }

  const v = validateRegistration(body);
  if (!v.ok) return oauthErrorResponse(400, v.error, v.description);

  try {
    const client = await registerClient({
      clientName: v.clientName,
      redirectUris: v.redirectUris,
      clientUri: v.clientUri,
    });
    maybePruneOAuth();
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        ...(client.clientUri ? { client_uri: client.clientUri } : {}),
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: OAUTH_SCOPE,
      },
      { status: 201, headers: { ...oauthCorsHeaders(), ...NO_STORE_HEADERS } }
    );
  } catch (err) {
    console.error("[oauth/register] failed:", err);
    return oauthErrorResponse(500, "server_error", "Registration failed");
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: oauthCorsHeaders() });
}
