import { type NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { notFound, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns a single catalog MCP's configSchema. Fetched lazily when the
// marketplace opens a detail/install dialog, so the browse list doesn't ship
// every server's config schema to the client up front.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  const [row] = await getDb()
    .select({ configSchema: mcpServers.configSchema })
    .from(mcpServers)
    .where(
      and(
        eq(mcpServers.id, id),
        or(eq(mcpServers.isPublic, true), eq(mcpServers.publishedByUserId, session.userId))
      )
    )
    .limit(1);

  if (!row) return notFound("MCP not found");
  return NextResponse.json({ configSchema: row.configSchema });
}
