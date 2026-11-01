import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { TopupConversion } from "@/components/analytics/ads-conversion";
import { getCheckoutConversion } from "@/lib/billing/checkout-conversion";
import { computeWalletNudge } from "@/lib/billing/upgrade-state";
import { isFundedAccount } from "@/lib/plan-features";
import { getWallet, decodeLedgerCursor, listLedger, type WalletView } from "@/lib/wallet/ledger";
import { AUTO_RECHARGE_LIMITS } from "@/lib/wallet/auto-recharge";
import { PRICING, publicPriceTable, whatTenEuroBuys } from "@/lib/wallet/pricing";
import { CreditsActions } from "./actions";
import { LedgerTable } from "./ledger-table";
import { PriceTable } from "./price-table";

export const dynamic = "force-dynamic";

const LEDGER_PAGE = 25;

/**
 * Credits (the old Billing page): prepaid balance, top-ups, auto-recharge,
 * the ledger and the price list. Server-rendered from Postgres — the balance
 * is never read from a cache here, and a read failure says so instead of
 * showing €0.
 */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; session_id?: string; cursor?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { topup, session_id: sessionId, cursor: cursorParam } = await searchParams;
  const cursor = cursorParam ? decodeLedgerCursor(cursorParam) : null;

  const db = getDb();
  const [userRows, wallet, ledger] = await Promise.all([
    db
      .select({
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    getWallet(user.id).catch((err: unknown): WalletView | null => {
      console.error("[credits] wallet read failed", err);
      return null;
    }),
    listLedger(user.id, { cursor, limit: LEDGER_PAGE }).catch((err: unknown) => {
      console.error("[credits] ledger read failed", err);
      return null;
    }),
  ]);
  const me = userRows[0];
  const plan = me?.plan ?? "free";

  // Stripe returns here after a paid top-up (success_url carries the session).
  // Verify the session server-side, then report the Google Ads conversion
  // client-side: value = what was paid, transaction_id = the session id.
  const conversion =
    topup === "success" && sessionId ? await getCheckoutConversion(sessionId, user.id) : null;

  const nudge = computeWalletNudge({
    plan,
    walletAvailable: wallet !== null,
    paidMicros: wallet?.paidMicros ?? 0,
    promoMicros: wallet?.promoMicros ?? 0,
    promoExpiresAt: wallet?.promoExpiresAt ?? null,
    // Same funded rule as every gate: a top-up, or a legacy subscription still
    // being paid. A never-paid trial row with plan='pro' is not funded.
    funded: isFundedAccount(wallet?.fundedAt ?? null, me?.subscriptionStatus),
    autoRechargeEnabled: wallet?.autoRecharge.enabled ?? false,
    serverCount: 0,
    subscriptionStatus: me?.subscriptionStatus ?? null,
    hasSubscription: Boolean(me?.stripeSubscriptionId),
  });
  const funded = Boolean(wallet?.funded);

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Credits"
        description="Prepaid, pay as you go. No subscription."
        actions={
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            Account
            <Badge variant={funded ? "success" : "offer"}>
              {funded ? "Pay as you go" : "Free credit"}
            </Badge>
          </span>
        }
      />

      <TopupConversion conversion={conversion} email={user.email} />

      <CreditsActions
        wallet={
          wallet
            ? {
                paidMicros: wallet.paidMicros,
                promoMicros: wallet.promoMicros,
                promoExpiresAt: wallet.promoExpiresAt?.toISOString() ?? null,
                promoExpired: wallet.promoExpired,
                totalMicros: wallet.totalMicros,
                funded,
                autoRecharge: wallet.autoRecharge,
              }
            : null
        }
        level={nudge.level}
        legacySubscription={nudge.legacySubscription}
        legacyPastDue={nudge.level === "past_due"}
        hasStripeCustomer={Boolean(me?.stripeCustomerId)}
        presetsEur={[...PRICING.topupPresetsEur]}
        minTopupEur={PRICING.minTopupEur}
        maxTopupEur={PRICING.maxTopupEur}
        autoRechargeLimits={{ ...AUTO_RECHARGE_LIMITS }}
        serverNow={new Date().toISOString()}
      />

      <PriceTable table={publicPriceTable()} buys={whatTenEuroBuys()} />

      <LedgerTable
        entries={
          ledger?.entries.map((e) => ({
            id: e.id,
            kind: e.kind,
            bucket: e.bucket,
            deltaMicros: e.deltaMicros,
            balanceAfterMicros: e.balanceAfterMicros,
            units: e.units,
            note: e.note,
            createdAt: e.createdAt.toISOString(),
          })) ?? null
        }
        nextCursor={ledger?.nextCursor ?? null}
        paged={Boolean(cursor)}
      />
    </div>
  );
}
