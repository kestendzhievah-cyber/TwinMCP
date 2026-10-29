import { NextResponse, type NextRequest } from "next/server";
import { requireManagementUser } from "@/lib/session";
import { serverError } from "@/lib/errors";
import { listConnections } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/oauth/connections — the connectors (Claude, ChatGPT, Cursor…)
 * the caller authorized through OAuth, one entry per grant. Management route:
 * a session or a full-access key; an OAuth token or an mcp_proxy key is refused.
 */
export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json({ connections: await listConnections(session.userId) });
  } catch (err) {
    console.error("[oauth/connections GET]", err);
    return serverError();
  }
}
