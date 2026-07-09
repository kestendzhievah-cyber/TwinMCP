import { type NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, usageMetrics, userServers, mcpServers } from "@/db/schema";
import { forbidden, serverError, unauthorized } from "@/lib/errors";
import { can, minPlanFor, PLAN_LABELS } from "@/lib/plan-features";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAYS = 90;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Quote a CSV field if it contains a comma, quote, or newline. */
function csv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), MAX_DAYS);

  try {
    const db = getDb();
    const [userRow] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    const plan = userRow?.plan ?? "free";
    if (!can(plan, "usageExport")) {
      return forbidden(
        `Exporting usage requires the ${PLAN_LABELS[minPlanFor("usageExport")]} plan.`
      );
    }

    const rangeStart = new Date(utcDayStart(new Date()).getTime() - (days - 1) * 86_400_000);

    const rows = await db
      .select({
        day: usageMetrics.periodStart,
        slug: mcpServers.slug,
        name: mcpServers.name,
        requests: sql<number>`sum(${usageMetrics.requestCount})::int`,
        errors: sql<number>`sum(${usageMetrics.errorsCount})::int`,
      })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .innerJoin(mcpServers, eq(userServers.mcpServerId, mcpServers.id))
      .where(and(eq(userServers.userId, session.userId), gte(usageMetrics.periodStart, rangeStart)))
      .groupBy(usageMetrics.periodStart, mcpServers.slug, mcpServers.name)
      .orderBy(asc(usageMetrics.periodStart), asc(mcpServers.slug));

    const header = "date,mcp_slug,mcp_name,requests,errors";
    const lines = rows.map((r) =>
      [
        new Date(r.day).toISOString().slice(0, 10),
        csv(r.slug),
        csv(r.name),
        r.requests ?? 0,
        r.errors ?? 0,
      ].join(",")
    );
    const body = [header, ...lines].join("\n") + "\n";
    const filename = `twinmcp-usage-${days}d.csv`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[usage/export]", err);
    return serverError();
  }
}
