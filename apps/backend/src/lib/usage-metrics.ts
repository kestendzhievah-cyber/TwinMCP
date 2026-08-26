import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { usageMetrics } from "@/db/schema/platform";

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// In-process aggregation of per-(user_server, UTC day) request/error counters.
// The MCP proxy calls recordMcpUsage on every JSON-RPC message; accumulating and
// flushing in batches turns one DB upsert per request into one upsert per
// user_server/day every FLUSH_INTERVAL_MS. Trades a small window of counter loss
// on a hard crash for a large drop in write volume.
interface PendingCounter {
  userServerId: string;
  periodStart: Date;
  periodEnd: Date;
  requests: number;
  errors: number;
}

const pending = new Map<string, PendingCounter>();
const FLUSH_INTERVAL_MS = Number(process.env.USAGE_FLUSH_INTERVAL_MS ?? 10_000);
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushUsage();
  }, FLUSH_INTERVAL_MS);
  // Don't keep the event loop alive just for a pending flush.
  flushTimer.unref?.();
}

/**
 * Record one metered MCP request. Synchronous + fire-and-forget: it only bumps
 * an in-memory counter and schedules a flush — it never blocks the proxy on a DB
 * write. Counts land in usage_metrics via flushUsage().
 */
export function recordMcpUsage(userServerId: string, ok: boolean): void {
  const periodStart = utcDayStart(new Date());
  const key = `${userServerId}:${periodStart.getTime()}`;
  const entry = pending.get(key);
  if (entry) {
    entry.requests += 1;
    if (!ok) entry.errors += 1;
  } else {
    pending.set(key, {
      userServerId,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 24 * 60 * 60 * 1000),
      requests: 1,
      errors: ok ? 0 : 1,
    });
  }
  scheduleFlush();
}

/** Flush accumulated counters — one upsert per (user_server, day). */
export async function flushUsage(): Promise<void> {
  if (pending.size === 0) return;
  const batch = [...pending.values()];
  pending.clear();
  const db = getDb();

  await Promise.all(
    batch.map((c) =>
      db
        .insert(usageMetrics)
        .values({
          id: randomUUID(),
          userServerId: c.userServerId,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          requestCount: c.requests,
          tokensUsed: 0,
          errorsCount: c.errors,
        })
        .onConflictDoUpdate({
          target: [usageMetrics.userServerId, usageMetrics.periodStart],
          set: {
            requestCount: sql`${usageMetrics.requestCount} + ${c.requests}`,
            errorsCount: sql`${usageMetrics.errorsCount} + ${c.errors}`,
          },
        })
        .catch((err) => {
          // Transient failure — fold the counts back in so they aren't lost.
          const key = `${c.userServerId}:${c.periodStart.getTime()}`;
          const existing = pending.get(key);
          if (existing) {
            existing.requests += c.requests;
            existing.errors += c.errors;
          } else {
            pending.set(key, c);
          }
          scheduleFlush();
          console.error("[usage-metrics] flush failed:", err);
        })
    )
  );
}
