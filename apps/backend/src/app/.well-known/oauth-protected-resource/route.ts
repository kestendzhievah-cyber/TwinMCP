import { NextResponse } from "next/server";
import {
  buildProtectedResourceMetadata,
  isOAuthEnabled,
  oauthCorsHeaders,
  oauthIssuer,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 9728 protected-resource metadata for the MCP proxy as a whole.
// Per-endpoint documents live under ./[...path] (/api/mcp/<server>[/<mcp>]).
export function GET() {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });
  return NextResponse.json(buildProtectedResourceMetadata(oauthIssuer(), ""), {
    headers: { ...oauthCorsHeaders(), "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: oauthCorsHeaders() });
}
