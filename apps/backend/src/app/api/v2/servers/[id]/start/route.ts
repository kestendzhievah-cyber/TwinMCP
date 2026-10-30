import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { badRequest, creditRequired, forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { logAudit, clientIp } from "@/lib/audit/log";
import { enqueue } from "@/lib/queue/qstash";
import {
  RuntimeGoneError,
  assertComputeAllowed,
  claimProvision,
  claimReprovision,
  isInsufficientCreditError,
  resumeServer,
} from "@/lib/provisioning";
import { isPausedRuntime, lifecycleActions } from "@/lib/server-lifecycle";
import { localAgentCommand } from "@/lib/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start / Resume. A paused server (contract K4: `stopped` with its box kept)
 * is woken in place, data intact. A server without a runtime (deleted, never
 * created, or failed) gets a provision job, which creates a box and installs
 * every enabled MCP from the saved configs.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  try {
    const srv = await assertServerOwnership(session.userId, id);
    if (srv.status === "running") {
      return badRequest("Server is already running");
    }
    if (srv.status === "destroyed") {
      return badRequest("Server has been destroyed and cannot be started");
    }
    if (srv.hostType === "local_agent") {
      return badRequest(
        `A local-agent server comes online when you run ${localAgentCommand(srv.slug)}`
      );
    }
    const actions = lifecycleActions(srv);
    if (!actions.start && !actions.resume) {
      return badRequest(`Server is ${srv.status}`);
    }

    if (isPausedRuntime(srv)) {
      try {
        await resumeServer(id);
        logAudit({
          userId: session.userId,
          action: "server.resume",
          targetType: "server",
          targetId: id,
          metadata: { mode: "resume" },
          ip: clientIp(req),
        });
        return NextResponse.json({ ok: true, status: "running" });
      } catch (err) {
        if (!(err instanceof RuntimeGoneError)) throw err;
        await assertComputeAllowed(session.userId);
        // The paused box was reaped upstream: fall through to a fresh one.
        Sentry.captureMessage(`paused box of server ${id} was gone on resume`, "warning");
        if (await claimReprovision(id)) {
          await enqueue({ type: "provision-server", serverId: id }).catch((e) =>
            console.error(`[server start] enqueue provision ${id} failed:`, e)
          );
        }
        logAudit({
          userId: session.userId,
          action: "server.start",
          targetType: "server",
          targetId: id,
          metadata: { mode: "reprovision", reason: "runtime_gone" },
          ip: clientIp(req),
        });
        return NextResponse.json({ ok: true, status: "provisioning", runtimeRecreated: true });
      }
    }

    // A fresh runtime is compute: refuse it up front without credit (fails
    // closed), so the user gets a 402 rather than a server that stays stopped.
    await assertComputeAllowed(session.userId);

    // Conditional claim: a double click (or two tabs) enqueues one job only.
    if (!(await claimProvision(id))) {
      return NextResponse.json({ ok: true, status: "provisioning" });
    }
    await enqueue({ type: "provision-server", serverId: id }).catch((err) =>
      console.error(`[server start] enqueue provision ${id} failed:`, err)
    );

    logAudit({
      userId: session.userId,
      action: "server.start",
      targetType: "server",
      targetId: id,
      metadata: { mode: "provision" },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, status: "provisioning" });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    if (isInsufficientCreditError(err)) return creditRequired(err.message);
    console.error("[server start]", err);
    return serverError();
  }
}
