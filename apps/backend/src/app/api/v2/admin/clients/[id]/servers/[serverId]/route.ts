import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema";
import { badRequest, creditRequired, notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import {
  RuntimeGoneError,
  claimProvision,
  claimReprovision,
  destroyServerRuntime,
  pauseServerRuntime,
  resumeServer,
  assertComputeAllowed,
  isInsufficientCreditError,
} from "@/lib/provisioning";
import { isPausedRuntime, lifecycleActions } from "@/lib/server-lifecycle";
import { enqueue } from "@/lib/queue/qstash";
import { logAudit, clientIp } from "@/lib/audit/log";
import { clearAuthCache } from "@/lib/auth";
import { localAgentCommand } from "@/lib/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lifecycle for a CLIENT's server, admin-side. PATCH {action:"stop"|"start"}
// pauses (box and data kept, contract K4) / resumes or provisions the box,
// exactly like the user's own Pause and Start routes; DELETE destroys the box and
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
      if (server.hostType === "local_agent") {
        return badRequest(
          "Serveur agent local : rien à mettre en pause (il tourne chez le client)."
        );
      }
      if (server.status === "stopped") return badRequest("Serveur déjà en pause.");
      if (server.status === "destroyed") return badRequest("Serveur détruit.");
      if (server.status === "provisioning") {
        return badRequest("Provisionnement en cours : attendez la fin avant de mettre en pause.");
      }
      if (!lifecycleActions(server).pause) {
        return badRequest(`Pause impossible (statut : ${server.status}).`);
      }
      const outcome = await pauseServerRuntime(serverId);
      logAudit({
        userId: clientId,
        action: "admin.server.pause",
        targetType: "server",
        targetId: serverId,
        metadata: { actorAdminId: admin.userId, mode: "pause", outcome },
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true, status: "stopped" });
    }

    if (action === "start") {
      if (server.status === "destroyed") return badRequest("Serveur détruit.");
      if (server.status === "running") return badRequest("Serveur déjà démarré.");
      if (server.hostType === "local_agent") {
        return badRequest(
          `Serveur agent local : il démarre avec ${localAgentCommand(server.slug)} chez le client.`
        );
      }
      const actions = lifecycleActions(server);
      if (!actions.start && !actions.resume) {
        return badRequest(`Démarrage impossible (statut : ${server.status}).`);
      }
      // Same logic as POST /api/v2/servers/:id/start: wake a paused box in
      // place; otherwise (or if the box was reaped) provision a fresh one from
      // the saved configs.
      let mode: "resume" | "provision" | "reprovision" = "provision";
      if (isPausedRuntime(server)) {
        try {
          await resumeServer(serverId);
          mode = "resume";
        } catch (err) {
          if (!(err instanceof RuntimeGoneError)) throw err;
          mode = "reprovision";
        }
      }
      // A fresh runtime is compute billed to the client's wallet.
      if (mode !== "resume") await assertComputeAllowed(clientId);
      // Conditional claims: a double click enqueues one provision job only.
      if (
        mode !== "resume" &&
        (mode === "provision" ? await claimProvision(serverId) : await claimReprovision(serverId))
      ) {
        await enqueue({ type: "provision-server", serverId }).catch((e) =>
          console.error(`[admin server start] enqueue provision ${serverId} failed:`, e)
        );
      }
      logAudit({
        userId: clientId,
        action: "admin.server.start",
        targetType: "server",
        targetId: serverId,
        metadata: { actorAdminId: admin.userId, mode },
        ip: clientIp(req),
      });
      return NextResponse.json({
        ok: true,
        status: mode === "resume" ? "running" : "provisioning",
      });
    }

    return badRequest("Action inconnue (attendu: stop | start).");
  } catch (err) {
    if (isInsufficientCreditError(err)) {
      return creditRequired(
        "Le crédit TwinMCP de ce client est épuisé : créditez son portefeuille avant de démarrer un serveur."
      );
    }
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
    // The FK cascade removed the API keys bound to this server: drop them from
    // the auth cache too, or they keep authenticating until its TTL.
    clearAuthCache();
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
