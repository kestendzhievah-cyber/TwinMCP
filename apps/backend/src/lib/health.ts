import { and, eq, lt, inArray } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { getBoxClient } from "@/lib/upstash/box-client";
import { emitWebhookEvent } from "@/lib/webhooks/emit";

// Box statuses that mean "gone for good" → the server should flip to `error`.
// getStatus() THROWS ("Box has been deleted") when a box is reaped, which we
// also treat as errored. Everything else — running / idle / paused — is a
// HEALTHY resume-on-demand box (idle boxes pause when not in use; that's
// normal, NOT an error), so we must not flag those.
const DEAD_STATUSES = new Set(["deleted", "stopped", "terminated", "failed"]);

// A server stuck in `provisioning` past this cutoff is treated as failed: its
// provisioning job died mid-flight (common in inline queue mode, which has no
// retry) and will never self-complete. Real provisioning finishes well under
// this, so we flip such servers to `error` — an actionable dashboard state the
// user can Start to retry — instead of an eternal "provisioning" badge that
// looks like work is still happening. Override via env for tuning.
const STUCK_PROVISIONING_MS = Number(process.env.STUCK_PROVISIONING_MS ?? 15 * 60_000);

/**
 * Background box-health reconciliation. For every server marked `running`, check
 * its box status: refresh `last_heartbeat_at` while the box still exists (even
 * if paused/idle), or flip it to `error` only if the box was deleted/reaped.
 * Also rescues servers wedged in `provisioning` past STUCK_PROVISIONING_MS.
 * Run on a schedule (QStash `reconcile-health` cron, or the optional in-process
 * loop in instrumentation.ts) — otherwise `last_heartbeat_at` only updates when
 * someone opens the server's /health page.
 */
export async function reconcileServerHealth(): Promise<{
  checked: number;
  errored: number;
  stuckProvisioning: number;
}> {
  const db = getDb();
  const running = await db
    .select({ id: servers.id, boxId: servers.boxId, userId: servers.userId, slug: servers.slug })
    .from(servers)
    .where(eq(servers.status, "running"));

  const client = getBoxClient();
  const withBox = running.filter(
    (s): s is (typeof running)[number] & { boxId: string } => !!s.boxId
  );

  // Check box status concurrently (getStatus is a read-only metadata call that
  // does NOT resume a paused box), bounded so a large fleet doesn't hammer the
  // box API, then batch the DB writes into two statements instead of N.
  const CONCURRENCY = 10;
  const deadIds: string[] = [];
  const aliveIds: string[] = [];
  for (let i = 0; i < withBox.length; i += CONCURRENCY) {
    const results = await Promise.all(
      withBox.slice(i, i + CONCURRENCY).map(async (s) => {
        try {
          return { id: s.id, dead: DEAD_STATUSES.has(await client.getStatus(s.boxId)) };
        } catch {
          // Thrown = the box no longer exists (deleted/reaped).
          return { id: s.id, dead: true };
        }
      })
    );
    for (const r of results) (r.dead ? deadIds : aliveIds).push(r.id);
  }

  if (deadIds.length > 0) {
    await db
      .update(servers)
      .set({ status: "error", updatedAt: new Date() })
      .where(inArray(servers.id, deadIds));
  }
  if (aliveIds.length > 0) {
    await db
      .update(servers)
      .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(inArray(servers.id, aliveIds));
  }
  const errored = deadIds.length;

  // Webhooks (fire-and-forget): the health check failed, and the server went
  // running → error. Metadata only.
  if (deadIds.length > 0) {
    const dead = new Set(deadIds);
    for (const s of running) {
      if (!dead.has(s.id)) continue;
      const base = { serverId: s.id, serverSlug: s.slug };
      emitWebhookEvent(s.userId, "server.health_failed", { ...base, reason: "box_gone" });
      emitWebhookEvent(s.userId, "server.status_changed", {
        ...base,
        from: "running",
        to: "error",
        reason: "health_check_failed",
      });
    }
  }

  // Rescue servers wedged in `provisioning` — a provisioning job that died and,
  // in inline queue mode, never retried. Flip them to `error` so the dashboard
  // stops showing a misleading "provisioning" badge and the user can retry.
  const cutoff = new Date(Date.now() - STUCK_PROVISIONING_MS);
  const stuck = await db
    .update(servers)
    .set({ status: "error", updatedAt: new Date() })
    .where(and(eq(servers.status, "provisioning"), lt(servers.updatedAt, cutoff)))
    .returning({ id: servers.id, userId: servers.userId, slug: servers.slug });
  for (const s of stuck) {
    emitWebhookEvent(s.userId, "server.status_changed", {
      serverId: s.id,
      serverSlug: s.slug,
      from: "provisioning",
      to: "error",
      reason: "provisioning_timed_out",
    });
  }
  if (stuck.length > 0) {
    console.warn(
      `[reconcile] ${stuck.length} server(s) stuck in provisioning past ${Math.round(
        STUCK_PROVISIONING_MS / 60000
      )}min → flipped to error`
    );
    Sentry.captureMessage(
      `reconcile: ${stuck.length} server(s) stuck in provisioning → error`,
      "warning"
    );
  }

  // Webhook retries whose in-memory timer was lost (inline queue + restart).
  // Rides on this scheduled job; never blocks or fails it.
  void import("@/lib/webhooks/deliver")
    .then(({ retryDueDeliveries }) => retryDueDeliveries())
    .catch((err) => console.warn("[reconcile] webhook retry sweep failed:", err));

  return { checked: running.length, errored, stuckProvisioning: stuck.length };
}
