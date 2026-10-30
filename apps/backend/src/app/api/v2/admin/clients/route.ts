import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  users,
  servers,
  userServers,
  usageMetrics,
  prospects,
  creditLedger,
  walletAccounts,
} from "@/db/schema";
import type { Plan } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { computeClientHealth } from "@/lib/admin/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Revenue = paid top-ups (Checkout + auto-recharge) over the last 30 days,
// NET of clawbacks (refunds, disputes), from the credit ledger (prepaid
// wallet since 2026-10-29; no subscription MRR). The response keeps the `mrr`
// key for the admin UI.
const REVENUE_KINDS = ["topup", "auto_recharge", "clawback"] as const;

const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const db = getDb();
  const since30 = new Date(Date.now() - 30 * DAY);

  const [userRows, serverAgg, mcpAgg, usageAgg, prospectRows, health, topupAgg, walletRows] =
    await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          plan: users.plan,
          subscriptionStatus: users.subscriptionStatus,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
      db
        .select({
          userId: servers.userId,
          status: servers.status,
          n: sql<number>`count(*)::int`,
        })
        .from(servers)
        .groupBy(servers.userId, servers.status),
      db
        .select({ userId: userServers.userId, n: sql<number>`count(*)::int` })
        .from(userServers)
        .where(eq(userServers.enabled, true))
        .groupBy(userServers.userId),
      db
        .select({
          userId: userServers.userId,
          req: sql<number>`coalesce(sum(${usageMetrics.requestCount}),0)::int`,
        })
        .from(usageMetrics)
        .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
        .where(gte(usageMetrics.periodStart, since30))
        .groupBy(userServers.userId),
      db
        .select({ email: prospects.email, status: prospects.status })
        .from(prospects)
        .where(isNotNull(prospects.email)),
      computeClientHealth(),
      db
        .select({
          userId: creditLedger.userId,
          micros: sql<number>`coalesce(sum(${creditLedger.deltaMicros}),0)::bigint`,
        })
        .from(creditLedger)
        .where(
          and(inArray(creditLedger.kind, [...REVENUE_KINDS]), gte(creditLedger.createdAt, since30))
        )
        .groupBy(creditLedger.userId),
      db
        .select({
          userId: walletAccounts.userId,
          paid: walletAccounts.paidMicros,
          promo: walletAccounts.promoMicros,
          promoExpiresAt: walletAccounts.promoExpiresAt,
        })
        .from(walletAccounts),
    ]);

  // Index the aggregates by userId for an O(users) merge.
  const serversByUser = new Map<string, { total: number; running: number; error: number }>();
  for (const r of serverAgg) {
    const cur = serversByUser.get(r.userId) ?? { total: 0, running: 0, error: 0 };
    cur.total += r.n;
    if (r.status === "running") cur.running += r.n;
    if (r.status === "error") cur.error += r.n;
    serversByUser.set(r.userId, cur);
  }
  const mcpsByUser = new Map(mcpAgg.map((r) => [r.userId, r.n]));
  const usageByUser = new Map(usageAgg.map((r) => [r.userId, r.req]));
  const healthByUser = new Map(health.map((h) => [h.userId, h.status]));
  const topupEurByUser = new Map(topupAgg.map((r) => [r.userId, Number(r.micros) / 1_000_000]));
  // Wallet balance (paid + unexpired promo), in euros. No row = empty wallet.
  const nowMs = Date.now();
  const balanceEurByUser = new Map(
    walletRows.map((w) => {
      const promoLive = !w.promoExpiresAt || w.promoExpiresAt.getTime() > nowMs;
      const micros = Number(w.paid) + (promoLive ? Number(w.promo) : 0);
      return [w.userId, micros / 1_000_000];
    })
  );

  // Prospect status by email (prefer "won" if a lead appears more than once).
  const crmByEmail = new Map<string, string>();
  for (const p of prospectRows) {
    const key = (p.email ?? "").toLowerCase();
    if (!key) continue;
    if (p.status === "won" || !crmByEmail.has(key)) crmByEmail.set(key, p.status);
  }

  let paying = 0;
  let running = 0;
  let mrr = 0;

  const clients = userRows.map((u) => {
    const s = serversByUser.get(u.id) ?? { total: 0, running: 0, error: 0 };
    const plan = u.plan as Plan;
    const price = Math.round((topupEurByUser.get(u.id) ?? 0) * 100) / 100;
    if (plan !== "free") paying += 1;
    running += s.running;
    mrr += price;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan,
      subscriptionStatus: u.subscriptionStatus,
      createdAt: u.createdAt,
      servers: s.total,
      serversRunning: s.running,
      serversError: s.error,
      mcps: mcpsByUser.get(u.id) ?? 0,
      mcpRequests30d: usageByUser.get(u.id) ?? 0,
      mrr: price,
      balanceEur: Math.round((balanceEurByUser.get(u.id) ?? 0) * 100) / 100,
      crmStatus: crmByEmail.get((u.email ?? "").toLowerCase()) ?? null,
      health: healthByUser.get(u.id) ?? "healthy",
    };
  });

  return NextResponse.json({
    clients,
    totals: {
      count: clients.length,
      paying,
      runningServers: running,
      mrr: Math.round(mrr * 100) / 100,
    },
  });
}
