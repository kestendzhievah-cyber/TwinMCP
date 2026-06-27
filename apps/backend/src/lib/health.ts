import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { getBoxClient } from "@/lib/upstash/box-client";

/**
 * Background box-health reconciliation. For every server marked `running`, ping
 * its box: refresh `last_heartbeat_at` if alive, or flip it to `error` if the
 * box/process is gone. Run on a schedule (see PRODUCTION.md) — without it,
 * `last_heartbeat_at` only updates when someone opens the server's /health.
 */
export async function reconcileServerHealth(): Promise<{ checked: number; errored: number }> {
  const db = getDb();
  const running = await db
    .select({ id: servers.id, boxId: servers.boxId })
    .from(servers)
    .where(eq(servers.status, "running"));

  const client = getBoxClient();
  let errored = 0;

  for (const s of running) {
    if (!s.boxId) continue;
    const alive = await client.ping(s.boxId).catch(() => false);
    if (alive) {
      await db
        .update(servers)
        .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
        .where(eq(servers.id, s.id));
    } else {
      errored++;
      await db
        .update(servers)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(servers.id, s.id));
    }
  }

  return { checked: running.length, errored };
}
