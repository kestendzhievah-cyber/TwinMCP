import { cache } from "react";
import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, usageMetrics, userServers, servers, type Plan } from "@/db/schema";
import { getDailyLimit } from "@/lib/rate-limit";
import type { UpgradeSignals } from "./upgrade-state";

/**
 * The inputs of computeUpgradeNudge() for a signed-in dashboard user, loaded
 * once per request: the layout (banner + nav link) and the overview page both
 * call this, and React's cache() dedupes the three queries between them.
 *
 * usedToday is today's tool calls: only `tools/call` counts toward the daily
 * cap (lib/mcp/billable.ts), and only those are metered into usage_metrics.
 * It is summed per UTC day exactly as the Usage page does; the cap itself is
 * enforced in Redis by lib/rate-limit.ts, so this is the displayed figure,
 * not the enforcement counter. Both activity
 * signals are best effort: a hiccup on usage_metrics or servers must never
 * 500 the whole dashboard, so each falls back to "no signal".
 */
export interface LoadedUpgradeSignals extends UpgradeSignals {
  plan: Plan;
  now: Date;
}

const noSignal = (what: string) => (err: unknown) => {
  console.warn(`[dashboard] ${what} signal unavailable:`, err);
  return [] as { n: number }[];
};

export const loadUpgradeSignals = cache(async (userId: string): Promise<LoadedUpgradeSignals> => {
  const db = getDb();
  const now = new Date();
  const utcDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [[row], [usage], [serverRow]] = await Promise.all([
    db
      .select({
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        currentPeriodEnd: users.currentPeriodEnd,
        cancelAtPeriodEnd: users.cancelAtPeriodEnd,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ n: sql<number>`coalesce(sum(${usageMetrics.requestCount}), 0)::int` })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(and(eq(userServers.userId, userId), gte(usageMetrics.periodStart, utcDayStart)))
      .catch(noSignal("usage")),
    db
      .select({ n: count() })
      .from(servers)
      .where(and(eq(servers.userId, userId), ne(servers.status, "destroyed")))
      .catch(noSignal("servers")),
  ]);

  const plan = row?.plan ?? "free";
  return {
    plan,
    usedToday: usage?.n ?? 0,
    dailyLimit: getDailyLimit(plan),
    proDailyLimit: getDailyLimit("pro"),
    serverCount: serverRow?.n ?? 0,
    subscriptionStatus: row?.subscriptionStatus ?? null,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
    hasStripeCustomer: Boolean(row?.stripeCustomerId),
    now,
  };
});
