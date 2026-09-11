import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, servers, userServers, usageMetrics } from "@/db/schema";

// Per-client churn/health signal, derived from usage trend + server errors + plan.
// Shared by the clients list (badge), the cockpit + digest ("clients à risque"),
// and the scheduled churn-alert cron.

export type HealthStatus = "healthy" | "at_risk" | "critical" | "inactive" | "new";

export interface ClientHealth {
  userId: string;
  email: string;
  plan: string;
  status: HealthStatus;
  reason: string;
  reqThis7d: number;
  reqPrev7d: number;
  serversError: number;
}

const DAY = 86_400_000;

// Ordering so "critical" surfaces first in lists.
const RANK: Record<HealthStatus, number> = {
  critical: 0,
  at_risk: 1,
  inactive: 2,
  new: 3,
  healthy: 4,
};

export async function computeClientHealth(): Promise<ClientHealth[]> {
  const db = getDb();
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY);
  const d14 = new Date(now - 14 * DAY);
  const req = sql<number>`coalesce(sum(${usageMetrics.requestCount}),0)::int`;

  const [userRows, thisWk, prevWk, errAgg, srvAgg] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, plan: users.plan, createdAt: users.createdAt })
      .from(users),
    db
      .select({ userId: userServers.userId, req })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(gte(usageMetrics.periodStart, d7))
      .groupBy(userServers.userId),
    db
      .select({ userId: userServers.userId, req })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(and(gte(usageMetrics.periodStart, d14), lt(usageMetrics.periodStart, d7)))
      .groupBy(userServers.userId),
    db
      .select({ userId: servers.userId, n: sql<number>`count(*)::int` })
      .from(servers)
      .where(eq(servers.status, "error"))
      .groupBy(servers.userId),
    db
      .select({ userId: servers.userId, n: sql<number>`count(*)::int` })
      .from(servers)
      .where(ne(servers.status, "destroyed"))
      .groupBy(servers.userId),
  ]);

  const thisMap = new Map(thisWk.map((r) => [r.userId, r.req]));
  const prevMap = new Map(prevWk.map((r) => [r.userId, r.req]));
  const errMap = new Map(errAgg.map((r) => [r.userId, r.n]));
  const srvMap = new Map(srvAgg.map((r) => [r.userId, r.n]));

  const out = userRows.map((u): ClientHealth => {
    const reqThis7d = thisMap.get(u.id) ?? 0;
    const reqPrev7d = prevMap.get(u.id) ?? 0;
    const serversError = errMap.get(u.id) ?? 0;
    const serverCount = srvMap.get(u.id) ?? 0;
    const paying = u.plan !== "free";
    const base = { userId: u.id, email: u.email, plan: u.plan, reqThis7d, reqPrev7d, serversError };

    if (u.createdAt.getTime() > now - 7 * DAY) {
      return { ...base, status: "new", reason: "Compte récent" };
    }
    if (paying && (serversError > 0 || (reqPrev7d > 0 && reqThis7d === 0))) {
      return {
        ...base,
        status: "critical",
        reason: serversError > 0 ? "Serveur(s) en erreur" : "Usage tombé à 0 (client payant)",
      };
    }
    if (serversError > 0) {
      return { ...base, status: "at_risk", reason: "Serveur(s) en erreur" };
    }
    if (reqPrev7d > 0 && reqThis7d <= reqPrev7d * 0.5) {
      return {
        ...base,
        status: "at_risk",
        reason: `Usage en baisse (${reqPrev7d} → ${reqThis7d})`,
      };
    }
    if (serverCount > 0 && reqThis7d === 0 && reqPrev7d === 0) {
      return { ...base, status: "inactive", reason: "Aucun usage récent" };
    }
    return { ...base, status: "healthy", reason: "OK" };
  });

  return out.sort((a, b) => RANK[a.status] - RANK[b.status]);
}

export function atRiskClients(health: ClientHealth[]): ClientHealth[] {
  return health.filter((h) => h.status === "critical" || h.status === "at_risk");
}
