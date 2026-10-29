import { type NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { destroyServerRuntime } from "@/lib/provisioning";
import { deleteRuntimeConfirmed, lifecycleActions } from "@/lib/server-lifecycle";
import { logAudit, clientIp } from "@/lib/audit/log";
import { enqueue } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restart = recreate the runtime: the box (and every file on it) is deleted,
 * then a fresh box is provisioned from the saved configs. Destructive like
 * "Delete runtime" (contract K4), so it takes the same typed confirmation,
 * checked here and not only in the dialog:
 *
 * Body: { "confirmName": "<the server's exact name>" }.
 *
 * To stop serving without losing data, use POST /servers/:id/pause.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  let confirmName = "";
  try {
    const body = (await req.json()) as { confirmName?: unknown };
    if (typeof body?.confirmName === "string") confirmName = body.confirmName;
  } catch {
    return badRequest(
      'Restart recreates the runtime and deletes the files in the box. Send { "confirmName": "<server name>" } to confirm'
    );
  }

  try {
    const srv = await assertServerOwnership(session.userId, id);
    if (srv.hostType === "local_agent") {
      return badRequest(
        "A local-agent server runs on your machine; there is no runtime to restart"
      );
    }
    if (!lifecycleActions(srv).restart) {
      return badRequest(`Server is ${srv.status}; only a running server can be restarted`);
    }
    if (!deleteRuntimeConfirmed(confirmName, srv.name)) {
      return badRequest("Type the server name exactly to confirm recreating its runtime");
    }

    const boxId = srv.boxId;
    await destroyServerRuntime(id);
    await enqueue({ type: "provision-server", serverId: id }).catch((err) =>
      console.error(`[server restart] enqueue provision ${id} failed:`, err)
    );

    logAudit({
      userId: session.userId,
      action: "server.restart",
      targetType: "server",
      targetId: id,
      metadata: { mode: "recreate_runtime", boxId },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, status: "provisioning" });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server restart]", err);
    return serverError();
  }
}
