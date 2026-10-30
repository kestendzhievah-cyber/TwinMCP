import { cache } from "react";
import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { users, servers, type Plan } from "@/db/schema";
import { walletAccounts } from "@/db/schema/wallet";
import type { WalletSignals } from "./upgrade-state";
import { NOTIFIED_KEYS, isFunded, killSwitchActive } from "@/lib/wallet/compute-meter";

/**
 * The inputs of computeWalletNudge() for a signed-in dashboard user, loaded
 * once per request: the layout (banner + balance pill) and the overview page
 * both call this, and React's cache() dedupes the queries between them.
 *
 * The wallet row is read straight from wallet_accounts (the same columns
 * lib/wallet/ledger.ts getWallet reads); promo credit past its expiry counts
 * as 0. A wallet that cannot be read sets walletAvailable=false so every
 * surface stays quiet: a dashboard read must never 500, and it is not the
 * enforcement point (the proxy's hasCredit fails closed on its own).
 */
export interface LoadedWalletSignals extends WalletSignals {
  plan: Plan;
  now: Date;
  hasStripeCustomer: boolean;
}

const noSignal = (what: string) => (err: unknown) => {
  console.warn(`[dashboard] ${what} signal unavailable:`, err);
  return null;
};

export const loadWalletSignals = cache(async (userId: string): Promise<LoadedWalletSignals> => {
  const db = getDb();
  const now = new Date();

  const [userRows, walletRows, serverRows] = await Promise.all([
    db
      .select({
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .catch(noSignal("user")),
    db
      .select({
        paidMicros: walletAccounts.paidMicros,
        promoMicros: walletAccounts.promoMicros,
        promoExpiresAt: walletAccounts.promoExpiresAt,
        fundedAt: walletAccounts.fundedAt,
        autoRechargeEnabled: walletAccounts.autoRechargeEnabled,
        notified: walletAccounts.notified,
      })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1)
      .catch(noSignal("wallet")),
    db
      .select({ n: count() })
      .from(servers)
      .where(and(eq(servers.userId, userId), ne(servers.status, "destroyed")))
      .catch(noSignal("servers")),
  ]);

  const row = userRows?.[0];
  const plan: Plan = row?.plan ?? "free";
  // null = the query failed; [] = no wallet row yet (a zero balance).
  const walletAvailable = walletRows !== null && userRows !== null;
  const w = walletRows?.[0];
  const promoExpiresAt = w?.promoExpiresAt ?? null;
  const promoLive = promoExpiresAt ? promoExpiresAt.getTime() > now.getTime() : true;
  // Funded = a first paid top-up (funded_at) or a legacy subscription still
  // being paid; never users.plan alone (billing no longer downgrades it, so a
  // converted trial can keep 'pro' without having paid). Same rule as the
  // compute meter's isFunded.
  const funded = isFunded(w?.fundedAt ?? null, row?.subscriptionStatus ?? null);
  const capFlag = (w?.notified as Record<string, unknown> | undefined)?.[NOTIFIED_KEYS.killSwitch];
  const promoCap = killSwitchActive(capFlag, now, funded)
    ? (capFlag as { reason?: string }).reason === "total"
      ? "total"
      : "daily"
    : null;

  return {
    plan,
    walletAvailable,
    paidMicros: Number(w?.paidMicros ?? 0),
    promoMicros: promoLive ? Number(w?.promoMicros ?? 0) : 0,
    promoExpiresAt,
    funded,
    promoCap,
    autoRechargeEnabled: Boolean(w?.autoRechargeEnabled),
    serverCount: Number(serverRows?.[0]?.n ?? 0),
    subscriptionStatus: row?.subscriptionStatus ?? null,
    hasSubscription: Boolean(row?.stripeSubscriptionId),
    hasStripeCustomer: Boolean(row?.stripeCustomerId),
    now,
  };
});
