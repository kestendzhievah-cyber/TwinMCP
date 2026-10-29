import { NextResponse } from "next/server";
import {
  buildAuthorizationServerMetadata,
  isOAuthEnabled,
  oauthCorsHeaders,
  oauthIssuer,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 8414 authorization-server metadata. MCP clients discover it from the
// protected-resource metadata the proxy's 401 points to (lib/oauth.ts).
export function GET() {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });
  return NextResponse.json(buildAuthorizationServerMetadata(oauthIssuer()), {
    headers: { ...oauthCorsHeaders(), "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: oauthCorsHeaders() });
}
