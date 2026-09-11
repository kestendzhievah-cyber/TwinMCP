import { type NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Installable catalog for the admin provisioning UI. Excludes twinmcp-docs
// (auto-installed on every box, not user-installable).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const items = await getDb()
    .select({
      id: mcpServers.id,
      slug: mcpServers.slug,
      name: mcpServers.name,
      description: mcpServers.description,
      category: mcpServers.category,
      hostMode: mcpServers.hostMode,
      runtime: mcpServers.runtime,
      configSchema: mcpServers.configSchema,
    })
    .from(mcpServers)
    .where(and(eq(mcpServers.isPublic, true), ne(mcpServers.slug, TWINMCP_DOCS_SLUG)))
    .orderBy(asc(mcpServers.name));

  return NextResponse.json({ items });
}
