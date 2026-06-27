import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  // OAuth is opt-in (Épopée 6 = API-key auth by default). Don't advertise OAuth
  // discovery unless explicitly enabled, so MCP clients use the ctx7sk_ Bearer key.
  if (process.env.OAUTH_ENABLED !== "1") {
    return new NextResponse(null, { status: 404 });
  }
  const origin = new URL(req.url).origin;
  const issuer = process.env.OAUTH_ISSUER ?? origin;

  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp.read", "mcp.write"],
  });
}
