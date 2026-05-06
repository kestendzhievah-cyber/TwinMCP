import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { slug } = await params;

  try {
    const [row] = await getDb()
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.slug, slug))
      .limit(1);
    if (!row) return notFound("MCP server not found");
    if (!row.isPublic && row.publishedByUserId !== session.userId) {
      return notFound("MCP server not found");
    }
    return NextResponse.json(row);
  } catch (err) {
    console.error("[mcp-servers/:slug GET]", err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { slug } = await params;

  try {
    const [row] = await getDb()
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.slug, slug))
      .limit(1);
    if (!row) return notFound("MCP server not found");
    if (row.publishedByUserId !== session.userId) {
      return forbidden("Only the publisher can delete this MCP server");
    }
    if (row.isOfficial) {
      return forbidden("Official MCP servers cannot be deleted via this endpoint");
    }

    await getDb().delete(mcpServers).where(eq(mcpServers.id, row.id));

    logAudit({
      userId: session.userId,
      action: "mcp_server.delete",
      targetType: "mcp_server",
      targetId: row.id,
      metadata: { slug },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && /foreign key/i.test(err.message)) {
      return forbidden("Cannot delete: this MCP is installed on one or more servers");
    }
    console.error("[mcp-servers/:slug DELETE]", err);
    return serverError();
  }
}
