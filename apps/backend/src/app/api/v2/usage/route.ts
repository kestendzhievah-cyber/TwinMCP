import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { usageEvents, users } from "@/db/schema";
import { serverError, unauthorized } from "@/lib/errors";
import { getDailyLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  try {
    const db = getDb();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [userRow] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const plan = userRow?.plan ?? "free";

    const [dayCount] = await db
      .select({ n: count() })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.userId), gte(usageEvents.timestamp, dayAgo)));

    const perEndpoint = await db
      .select({
        endpoint: usageEvents.endpoint,
        n: count(),
        avgLatency: sql<number>`avg(${usageEvents.latencyMs})::int`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.userId), gte(usageEvents.timestamp, dayAgo)))
      .groupBy(usageEvents.endpoint);

    return NextResponse.json({
      plan,
      dailyLimit: getDailyLimit(plan),
      last24h: dayCount?.n ?? 0,
      perEndpoint,
    });
  } catch (err) {
    console.error("[usage]", err);
    return serverError();
  }
}
