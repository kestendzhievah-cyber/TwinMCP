import { and, eq, lt } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { getBoxClient } from "@/lib/upstash/box-client";

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
    .select({ id: servers.id, boxId: servers.boxId })
    .from(servers)
    .where(eq(servers.status, "running"));

  const client = getBoxClient();
  let errored = 0;

  for (const s of running) {
    if (!s.boxId) continue;
    // getStatus() is a metadata read — it does NOT resume a paused box (unlike
    // ping(), which execs `true` and would fail/wake an idle box).
    let dead = false;
    try {
      const status = await client.getStatus(s.boxId);
      dead = DEAD_STATUSES.has(status);
    } catch {
      // Thrown = the box no longer exists (deleted/reaped).
      dead = true;
    }
    if (dead) {
      errored++;
      await db
        .update(servers)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(servers.id, s.id));
    } else {
      await db
        .update(servers)
        .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
        .where(eq(servers.id, s.id));
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
    .returning({ id: servers.id });
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

  return { checked: running.length, errored, stuckProvisioning: stuck.length };
}
