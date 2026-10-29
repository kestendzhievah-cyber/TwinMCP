import { type NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { pauseServerRuntime } from "@/lib/provisioning";
import { lifecycleActions } from "@/lib/server-lifecycle";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pause a server (contract K4): the box is paused, its disk (installed
 * packages, files, logs) and every config are kept. The next MCP request or
 * Resume wakes it. Nothing is deleted — that is DELETE /servers/:id/runtime.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  try {
    const srv = await assertServerOwnership(session.userId, id);
    if (srv.hostType === "local_agent") {
      return badRequest("A local-agent server runs on your machine; there is no runtime to pause");
    }
    if (srv.status === "destroyed") return badRequest("Server has been destroyed");
    if (!lifecycleActions(srv).pause) {
      return badRequest(
        srv.status === "stopped" ? "Server is already paused" : `Server is ${srv.status}`
      );
    }

    const outcome = await pauseServerRuntime(id);

    logAudit({
      userId: session.userId,
      action: "server.pause",
      targetType: "server",
      targetId: id,
      metadata: { mode: "pause", outcome },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, status: "paused", outcome });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server pause]", err);
    return serverError();
  }
}
