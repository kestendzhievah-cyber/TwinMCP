import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers, userServers, servers } from "@/db/schema";
import { notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { enqueue } from "@/lib/queue/qstash";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin uninstalls an MCP from a CLIENT's server. Mirrors the self-serve
// uninstall (capture box teardown info, delete the row, enqueue uninstall-mcp),
// but scoped to "this install belongs to this client's server", audited with
// the acting admin.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string; userServerId: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id: clientId, serverId, userServerId } = await params;
  const db = getDb();

  const [us] = await db.select().from(userServers).where(eq(userServers.id, userServerId)).limit(1);
  if (!us || us.serverId !== serverId || us.userId !== clientId) {
    return notFound("Installation introuvable pour ce client");
  }

  try {
    // Capture box teardown info before the row is gone.
    const [meta] = await db
      .select({ slug: mcpServers.slug, boxId: servers.boxId, port: userServers.bridgePort })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .innerJoin(servers, eq(servers.id, userServers.serverId))
      .where(eq(userServers.id, userServerId))
      .limit(1);

    await db.delete(userServers).where(eq(userServers.id, userServerId));

    if (meta) {
      await enqueue({
        type: "uninstall-mcp",
        boxId: meta.boxId,
        serverId,
        slug: meta.slug,
        port: meta.port,
      }).catch((err) =>
        console.error(`[admin mcp uninstall] enqueue uninstall ${userServerId} failed:`, err)
      );
    }

    logAudit({
      userId: clientId,
      action: "admin.mcp.uninstall",
      targetType: "user_server",
      targetId: userServerId,
      metadata: { serverId, mcpServerId: us.mcpServerId, actorAdminId: admin.userId },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin mcp uninstall]", err);
    return serverError();
  }
}
