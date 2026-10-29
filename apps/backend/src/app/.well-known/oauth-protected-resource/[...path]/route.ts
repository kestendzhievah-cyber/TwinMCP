import { NextResponse } from "next/server";
import {
  buildProtectedResourceMetadata,
  isMcpResourcePath,
  isOAuthEnabled,
  oauthCorsHeaders,
  oauthIssuer,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

// RFC 9728 §3.1 path-inserted metadata: /.well-known/oauth-protected-resource
// + the MCP endpoint path (/api/mcp/<server> or /api/mcp/<server>/<mcp>). The
// proxy's 401 WWW-Authenticate points here (resource_metadata=…).
export async function GET(_req: Request, { params }: Ctx) {
  if (!isOAuthEnabled()) return new NextResponse(null, { status: 404 });
  const { path } = await params;
  const resourcePath = `/${path.join("/")}`;
  if (!isMcpResourcePath(resourcePath)) return new NextResponse(null, { status: 404 });
  return NextResponse.json(buildProtectedResourceMetadata(oauthIssuer(), resourcePath), {
    headers: { ...oauthCorsHeaders(), "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: oauthCorsHeaders() });
}
