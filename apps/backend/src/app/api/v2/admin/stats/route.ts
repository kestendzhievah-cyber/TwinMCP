import { type NextRequest, NextResponse } from "next/server";
import { count, desc, eq, gte, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  users,
  servers,
  mcpServers,
  libraries,
  apiKeys,
  usageEvents,
  usageMetrics,
  auditLogs,
} from "@/db/schema";
import { forbidden, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import type { Plan } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Monthly-equivalent price used for the MRR estimate. Cadence isn't stored on
// the user row, so this is an intentional upper bound (all paid = monthly).
const PRO_MONTHLY_EUR = 14.99;
const TEAM_MONTHLY_EUR = 0; // Team isn't sold yet — counted separately, €0 in MRR.

/** UTC calendar-day key, e.g. "2026-07-29". */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Group timestamps by their UTC calendar day so the JS zero-fill below lines up.
const utcDay = (col: unknown) => sql<string>`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

function zeroFill(
  rows: { day: string; n: number }[],
  days: number
): { date: string; value: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const start = Date.now() - (days - 1) * 86_400_000;
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(start + i * 86_400_000));
    out.push({ date: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  if (!isAdminEmail(session.email)) return forbidden("Admins only");

  try {
    const db = getDb();
    const now = Date.now();
    const d1 = new Date(now - 86_400_000);
    const d7 = new Date(now - 7 * 86_400_000);
    const d30 = new Date(now - 30 * 86_400_000);

    const errExpr = sql<number>`sum(case when ${usageEvents.statusCode} >= 400 then 1 else 0 end)::int`;

    const [
      totalUsersRow,
      planRows,
      newUsers7Row,
      newUsers30Row,
      payingRow,
      totalServersRow,
      serverStatusRows,
      newServers7Row,
      api24Row,
      api7Row,
      mcp7Row,
      totalMcpRow,
      communityMcpRow,
      totalLibRow,
      activeKeysRow,
      signupSeries,
      apiSeries,
      topEndpoints,
      recentSignups,
      recentActivity,
    ] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ plan: users.plan, n: count() }).from(users).groupBy(users.plan),
      db.select({ n: count() }).from(users).where(gte(users.createdAt, d7)),
      db.select({ n: count() }).from(users).where(gte(users.createdAt, d30)),
      db.select({ n: count() }).from(users).where(ne(users.plan, "free")),
      db.select({ n: count() }).from(servers),
      db.select({ status: servers.status, n: count() }).from(servers).groupBy(servers.status),
      db.select({ n: count() }).from(servers).where(gte(servers.createdAt, d7)),
      db
        .select({
          n: count(),
          errors: errExpr,
          avgLatency: sql<number>`coalesce(avg(${usageEvents.latencyMs})::int, 0)`,
        })
        .from(usageEvents)
        .where(gte(usageEvents.timestamp, d1)),
      db.select({ n: count() }).from(usageEvents).where(gte(usageEvents.timestamp, d7)),
      db
        .select({
          requests: sql<number>`coalesce(sum(${usageMetrics.requestCount}), 0)::int`,
          errors: sql<number>`coalesce(sum(${usageMetrics.errorsCount}), 0)::int`,
        })
        .from(usageMetrics)
        .where(gte(usageMetrics.periodStart, d7)),
      db.select({ n: count() }).from(mcpServers),
      db.select({ n: count() }).from(mcpServers).where(isNotNull(mcpServers.publishedByUserId)),
      db.select({ n: count() }).from(libraries),
      db
        .select({ n: count() })
        .from(apiKeys)
        .where(sql`${apiKeys.revokedAt} is null`),
      db
        .select({ day: utcDay(users.createdAt), n: count() })
        .from(users)
        .where(gte(users.createdAt, d30))
        .groupBy(utcDay(users.createdAt)),
      db
        .select({ day: utcDay(usageEvents.timestamp), n: count() })
        .from(usageEvents)
        .where(gte(usageEvents.timestamp, new Date(now - 13 * 86_400_000)))
        .groupBy(utcDay(usageEvents.timestamp)),
      db
        .select({
          endpoint: usageEvents.endpoint,
          n: count(),
          errors: errExpr,
          avgLatency: sql<number>`coalesce(avg(${usageEvents.latencyMs})::int, 0)`,
        })
        .from(usageEvents)
        .where(gte(usageEvents.timestamp, d1))
        .groupBy(usageEvents.endpoint)
        .orderBy(desc(count()))
        .limit(8),
      db
        .select({ email: users.email, plan: users.plan, createdAt: users.createdAt })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(10),
      db
        .select({
          action: auditLogs.action,
          targetType: auditLogs.targetType,
          createdAt: auditLogs.createdAt,
          email: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(12),
    ]);

    const byPlan = { free: 0, pro: 0, team: 0 } as Record<Plan, number>;
    for (const r of planRows) byPlan[r.plan] = r.n;

    const serversByStatus: Record<string, number> = {};
    for (const r of serverStatusRows) serversByStatus[r.status] = r.n;

    const mrrEstimate = byPlan.pro * PRO_MONTHLY_EUR + byPlan.team * TEAM_MONTHLY_EUR;
    const api24 = api24Row[0] ?? { n: 0, errors: 0, avgLatency: 0 };

    return NextResponse.json({
      generatedAt: new Date(now).toISOString(),
      users: {
        total: totalUsersRow[0]?.n ?? 0,
        byPlan,
        new7d: newUsers7Row[0]?.n ?? 0,
        new30d: newUsers30Row[0]?.n ?? 0,
        paying: payingRow[0]?.n ?? 0,
      },
      revenue: {
        mrrEstimate: Math.round(mrrEstimate * 100) / 100,
        currency: "EUR",
        payingUsers: payingRow[0]?.n ?? 0,
      },
      servers: {
        total: totalServersRow[0]?.n ?? 0,
        byStatus: serversByStatus,
        running: serversByStatus.running ?? 0,
        new7d: newServers7Row[0]?.n ?? 0,
      },
      traffic: {
        api24h: api24.n,
        apiErrors24h: api24.errors ?? 0,
        apiAvgLatency24h: api24.avgLatency ?? 0,
        api7d: api7Row[0]?.n ?? 0,
        mcpRequests7d: mcp7Row[0]?.requests ?? 0,
        mcpErrors7d: mcp7Row[0]?.errors ?? 0,
        topEndpoints,
      },
      catalog: {
        mcpServers: totalMcpRow[0]?.n ?? 0,
        communityMcps: communityMcpRow[0]?.n ?? 0,
        libraries: totalLibRow[0]?.n ?? 0,
        activeApiKeys: activeKeysRow[0]?.n ?? 0,
      },
      series: {
        signups30d: zeroFill(signupSeries, 30),
        api14d: zeroFill(apiSeries, 14),
      },
      recentSignups: recentSignups.map((r) => ({
        email: r.email,
        plan: r.plan,
        createdAt: r.createdAt,
      })),
      recentActivity: recentActivity.map((r) => ({
        action: r.action,
        targetType: r.targetType,
        email: r.email,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    return serverError();
  }
}
