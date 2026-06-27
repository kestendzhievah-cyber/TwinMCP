import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { usageMetrics } from "@/db/schema/platform";

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Increment the per-user_server daily request/error counters (usage_metrics).
 * One row per (user_server, UTC day); upserts via the unique index added in
 * migration 0005/0006. Fire-and-forget from the MCP proxy — never block a
 * request on metering.
 */
export async function recordMcpUsage(userServerId: string, ok: boolean): Promise<void> {
  const now = new Date();
  const periodStart = utcDayStart(now);
  const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
  const errInc = ok ? 0 : 1;

  await getDb()
    .insert(usageMetrics)
    .values({
      id: randomUUID(),
      userServerId,
      periodStart,
      periodEnd,
      requestCount: 1,
      tokensUsed: 0,
      errorsCount: errInc,
    })
    .onConflictDoUpdate({
      target: [usageMetrics.userServerId, usageMetrics.periodStart],
      set: {
        requestCount: sql`${usageMetrics.requestCount} + 1`,
        errorsCount: sql`${usageMetrics.errorsCount} + ${errInc}`,
      },
    });
}
