import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema";
import { badRequest, notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { destroyServerRuntime, resumeServer } from "@/lib/provisioning";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lifecycle for a CLIENT's server, admin-side. PATCH {action:"stop"|"start"}
// tears down / wakes the box (keeps the row); DELETE destroys the box and
// removes the row (cascade removes its MCP installs). Ownership check is "server
// belongs to this client"; audited with the acting admin.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id: clientId, serverId } = await params;
  const db = getDb();

  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server || server.userId !== clientId) return notFound("Serveur introuvable pour ce client");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const action = (body as { action?: string })?.action;

  try {
    if (action === "stop") {
      if (server.status === "stopped") return badRequest("Serveur déjà arrêté.");
      if (server.status === "destroyed") return badRequest("Serveur détruit.");
      await destroyServerRuntime(serverId);
      logAudit({
        userId: clientId,
        action: "admin.server.stop",
        targetType: "server",
        targetId: serverId,
        metadata: { actorAdminId: admin.userId },
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true, status: "stopped" });
    }

    if (action === "start") {
      if (server.status === "destroyed") return badRequest("Serveur détruit.");
      await resumeServer(serverId);
      logAudit({
        userId: clientId,
        action: "admin.server.start",
        targetType: "server",
        targetId: serverId,
        metadata: { actorAdminId: admin.userId },
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true, status: "running" });
    }

    return badRequest("Action inconnue (attendu: stop | start).");
  } catch (err) {
    console.error("[admin server lifecycle]", err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id: clientId, serverId } = await params;
  const db = getDb();

  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server || server.userId !== clientId) return notFound("Serveur introuvable pour ce client");

  try {
    await destroyServerRuntime(serverId);
    await db.delete(servers).where(eq(servers.id, serverId));
    logAudit({
      userId: clientId,
      action: "admin.server.delete",
      targetType: "server",
      targetId: serverId,
      metadata: { actorAdminId: admin.userId },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin server delete]", err);
    return serverError();
  }
}
