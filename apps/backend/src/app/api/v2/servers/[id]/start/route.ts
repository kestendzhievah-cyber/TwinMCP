import { type NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { logAudit, clientIp } from "@/lib/audit/log";
import { enqueue } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  try {
    const srv = await assertServerOwnership(session.userId, id);
    if (srv.status === "running") {
      return badRequest("Server is already running");
    }
    if (srv.status === "destroyed") {
      return badRequest("Server has been destroyed and cannot be started");
    }

    await enqueue({ type: "provision-server", serverId: id }).catch((err) =>
      console.error(`[server start] enqueue provision ${id} failed:`, err)
    );

    logAudit({
      userId: session.userId,
      action: "server.start",
      targetType: "server",
      targetId: id,
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, status: "provisioning" });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server start]", err);
    return serverError();
  }
}
