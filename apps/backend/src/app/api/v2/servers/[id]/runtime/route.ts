import { type NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { destroyServerRuntime } from "@/lib/provisioning";
import { deleteRuntimeConfirmed, lifecycleActions } from "@/lib/server-lifecycle";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Delete runtime" (contract K4): destroy the box and everything on its disk
 * (installed packages, files the MCPs wrote, logs). The server, its MCP list,
 * their configs and the API keys are kept; Start provisions a fresh box.
 *
 * Body: { "confirmName": "<the server's exact name>" }. Checked here too, not
 * only in the dialog, so a stray API call cannot wipe a runtime.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  let confirmName = "";
  try {
    const body = (await req.json()) as { confirmName?: unknown };
    if (typeof body?.confirmName === "string") confirmName = body.confirmName;
  } catch {
    return badRequest('Send { "confirmName": "<server name>" } to confirm');
  }

  try {
    const srv = await assertServerOwnership(session.userId, id);
    if (srv.hostType === "local_agent") {
      return badRequest("A local-agent server runs on your machine; there is no runtime to delete");
    }
    if (!lifecycleActions(srv).deleteRuntime) {
      return badRequest("This server has no runtime to delete");
    }
    if (!deleteRuntimeConfirmed(confirmName, srv.name)) {
      return badRequest("Type the server name exactly to confirm deleting its runtime");
    }

    const boxId = srv.boxId;
    await destroyServerRuntime(id);

    // A distinct action from Pause, so audit filters can tell a harmless pause
    // from a destructive runtime deletion.
    logAudit({
      userId: session.userId,
      action: "server.runtime.delete",
      targetType: "server",
      targetId: id,
      metadata: { mode: "delete_runtime", boxId },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, status: "stopped", runtime: "deleted" });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server runtime delete]", err);
    return serverError();
  }
}
