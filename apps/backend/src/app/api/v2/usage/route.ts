import { type NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { usageEvents, users, usageMetrics, userServers, mcpServers } from "@/db/schema";
import { serverError, unauthorized } from "@/lib/errors";
import { getDailyLimit } from "@/lib/rate-limit";
import { can } from "@/lib/plan-features";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAYS = 90;

/** UTC midnight of `d`. */
function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), MAX_DAYS);

  try {
    const db = getDb();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rangeStart = new Date(utcDayStart(new Date()).getTime() - (days - 1) * 86_400_000);

    // Ownership filter used by the two usageMetrics queries.
    const owned = and(
      eq(userServers.userId, session.userId),
      gte(usageMetrics.periodStart, rangeStart)
    );

    // All five reads are independent — run them as one concurrent batch.
    const [userRows, dayCounts, perEndpoint, dailyRows, perMcp] = await Promise.all([
      db.select({ plan: users.plan }).from(users).where(eq(users.id, session.userId)).limit(1),
      db
        .select({ n: count() })
        .from(usageEvents)
        .where(and(eq(usageEvents.userId, session.userId), gte(usageEvents.timestamp, dayAgo))),
      db
        .select({
          endpoint: usageEvents.endpoint,
          n: count(),
          avgLatency: sql<number>`coalesce(avg(${usageEvents.latencyMs})::int, 0)`,
        })
        .from(usageEvents)
        .where(and(eq(usageEvents.userId, session.userId), gte(usageEvents.timestamp, dayAgo)))
        .groupBy(usageEvents.endpoint)
        .orderBy(desc(count())),
      db
        .select({
          day: usageMetrics.periodStart,
          requests: sql<number>`sum(${usageMetrics.requestCount})::int`,
          errors: sql<number>`sum(${usageMetrics.errorsCount})::int`,
        })
        .from(usageMetrics)
        .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
        .where(owned)
        .groupBy(usageMetrics.periodStart)
        .orderBy(usageMetrics.periodStart),
      db
        .select({
          slug: mcpServers.slug,
          name: mcpServers.name,
          requests: sql<number>`sum(${usageMetrics.requestCount})::int`,
          errors: sql<number>`sum(${usageMetrics.errorsCount})::int`,
        })
        .from(usageMetrics)
        .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
        .innerJoin(mcpServers, eq(userServers.mcpServerId, mcpServers.id))
        .where(owned)
        .groupBy(mcpServers.slug, mcpServers.name)
        .orderBy(desc(sql`sum(${usageMetrics.requestCount})`)),
    ]);
    const plan = userRows[0]?.plan ?? "free";
    const dayCount = dayCounts[0];

    // Zero-fill a bar per day so the chart is continuous.
    const byDay = new Map(dailyRows.map((r) => [dateKey(new Date(r.day)), r]));
    const daily: { date: string; requests: number; errors: number }[] = [];
    let totalRequests = 0;
    let totalErrors = 0;
    for (let i = 0; i < days; i++) {
      const key = dateKey(new Date(rangeStart.getTime() + i * 86_400_000));
      const row = byDay.get(key);
      const requests = row?.requests ?? 0;
      const errors = row?.errors ?? 0;
      totalRequests += requests;
      totalErrors += errors;
      daily.push({ date: key, requests, errors });
    }

    return NextResponse.json({
      plan,
      days,
      dailyLimit: getDailyLimit(plan),
      usageExport: can(plan, "usageExport"),
      last24h: dayCount?.n ?? 0,
      perEndpoint,
      runtime: {
        totals: { requests: totalRequests, errors: totalErrors },
        daily,
        perMcp,
      },
    });
  } catch (err) {
    console.error("[usage]", err);
    return serverError();
  }
}
