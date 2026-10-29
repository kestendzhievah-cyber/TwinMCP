import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, servers, userServers, usageMetrics } from "@/db/schema";
import type { Plan } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { toCsv } from "@/lib/admin/csv";
import { clientIp, logAudit } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const PLANS: (Plan | "all")[] = ["free", "pro", "team", "all"];

function day(d: Date | string | null | undefined): string {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
}

/**
 * Admin-only CSV of the users on a plan (default: free), for an upgrade
 * campaign in an emailing tool. Columns match the merge fields of the upgrade
 * email. "eligible_mois_offert" is "oui" only for users who never had a Stripe
 * customer: the one-month trial is granted to first-time subscribers only.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const requested = (new URL(req.url).searchParams.get("plan") ?? "free") as Plan | "all";
  const plan = PLANS.includes(requested) ? requested : "free";

  const db = getDb();
  const since7 = new Date(Date.now() - 7 * DAY);

  const [userRows, serverAgg, mcpAgg, usage7, lastSeen] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        plan: users.plan,
        createdAt: users.createdAt,
        onboardingCompletedAt: users.onboardingCompletedAt,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(plan === "all" ? undefined : eq(users.plan, plan))
      .orderBy(desc(users.createdAt)),
    db
      .select({ userId: servers.userId, n: sql<number>`count(*)::int` })
      .from(servers)
      .where(ne(servers.status, "destroyed"))
      .groupBy(servers.userId),
    db
      .select({ userId: userServers.userId, n: sql<number>`count(*)::int` })
      .from(userServers)
      .groupBy(userServers.userId),
    db
      .select({
        userId: userServers.userId,
        n: sql<number>`coalesce(sum(${usageMetrics.requestCount}), 0)::int`,
      })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(gte(usageMetrics.periodStart, since7))
      .groupBy(userServers.userId),
    db
      .select({
        userId: userServers.userId,
        last: sql<string | null>`max(${usageMetrics.periodStart})`,
      })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .groupBy(userServers.userId),
  ]);

  const byUser = <T extends { userId: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.userId, r]));
  const srv = byUser(serverAgg);
  const mcp = byUser(mcpAgg);
  const req7 = byUser(usage7);
  const seen = byUser(lastSeen);

  const header = [
    "email",
    "prenom",
    "nom",
    "plan",
    "date_inscription",
    "onboarding_termine",
    "serveurs",
    "mcp_installes",
    "requetes_7j",
    "derniere_activite",
    "deja_abonne",
    "eligible_mois_offert",
  ];
  const rows = userRows.map((u) => {
    const name = (u.name ?? "").trim();
    const hadSubscription = Boolean(u.stripeCustomerId);
    return [
      u.email,
      name.split(/\s+/)[0] ?? "",
      name,
      u.plan,
      day(u.createdAt),
      u.onboardingCompletedAt ? "oui" : "non",
      srv.get(u.id)?.n ?? 0,
      mcp.get(u.id)?.n ?? 0,
      req7.get(u.id)?.n ?? 0,
      day(seen.get(u.id)?.last),
      hadSubscription ? "oui" : "non",
      !hadSubscription && u.plan === "free" ? "oui" : "non",
    ];
  });

  logAudit({
    userId: admin.userId,
    action: "admin.clients.export",
    targetType: "user",
    metadata: { plan, rows: rows.length },
    ip: clientIp(req),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(header, rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="twinmcp-utilisateurs-${plan}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
