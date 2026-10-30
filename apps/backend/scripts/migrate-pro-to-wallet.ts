// Convert every live Pro/Team subscription into prepaid wallet credit
// (owner decision 2026-10-29: no more subscriptions).
//
// For each subscription in Stripe:
//   active / past_due  credit the PAID bucket with the unused, prorated part of
//                      the last paid invoice, EXCLUDING TAX (idempotency key
//                      `subconv:<subscriptionId>`), then cancel the
//                      subscription immediately (prorate=false, no Stripe
//                      refund), mark the wallet funded, audit, and email the
//                      user ('subscription_converted' with the amount);
//   trialing           cancel immediately (nothing was paid) and grant the
//                      €10 sign-up promo if the account never claimed it.
// Order matters for re-runs: credit first, cancel second. A crash between the
// two leaves a live subscription whose credit key already exists, so the next
// run only cancels it. Safe to re-run.
//
// Usage (from apps/backend):
//   npx tsx scripts/migrate-pro-to-wallet.ts            # DRY RUN: prints the plan, writes nothing
//   npx tsx scripts/migrate-pro-to-wallet.ts --apply    # does it
//   … --only sub_123                                    # one subscription
//
// Needs STRIPE_SECRET_KEY and DATABASE_URL (or DATABASE_URL_UNPOOLED) in the
// environment or .env.local. Review the dry run with the accountant first.

import { config as loadEnv } from "dotenv";

// ---------------------------------------------------------------------------
// Pure helpers (exported for __tests__/migrate-pro-to-wallet.test.ts)
// ---------------------------------------------------------------------------

export const MICROS_PER_CENT = 10_000;

/**
 * The unused part of a paid period, in cents: amount × (end − now) / (end − start),
 * clamped to [0, amount], floored (rounding never favours the house… nor
 * invents a cent). Times are unix SECONDS.
 */
export function proratedUnusedCents(i: {
  amountExTaxCents: number;
  periodStart: number;
  periodEnd: number;
  now: number;
}): number {
  const amount = Math.trunc(i.amountExTaxCents);
  if (!(amount > 0) || !(i.periodEnd > i.periodStart)) return 0;
  const fraction = (i.periodEnd - i.now) / (i.periodEnd - i.periodStart);
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.floor(amount * clamped);
}

export interface InvoiceLike {
  id?: string | null;
  status?: string | null;
  created: number;
  amount_paid: number;
  total_excluding_tax?: number | null;
  subtotal_excluding_tax?: number | null;
  lines?: {
    data?: Array<{ amount?: number | null; period?: { start: number; end: number } | null }>;
  } | null;
}

/** The most recent paid invoice that actually took money (null when none). */
export function lastPaidInvoice<T extends InvoiceLike>(invoices: readonly T[]): T | null {
  let best: T | null = null;
  for (const inv of invoices) {
    if (inv.status !== "paid" || !(inv.amount_paid > 0)) continue;
    if (!best || inv.created > best.created) best = inv;
  }
  return best;
}

/**
 * What the invoice charged before tax, never more than what was actually
 * paid: total_excluding_tax (discounts applied, tax removed), else
 * subtotal_excluding_tax, else amount_paid.
 */
export function invoiceAmountExTaxCents(inv: InvoiceLike): number {
  const exTax = inv.total_excluding_tax ?? inv.subtotal_excluding_tax ?? inv.amount_paid;
  return Math.max(0, Math.min(Math.trunc(exTax), Math.trunc(inv.amount_paid)));
}

/**
 * The service period the invoice paid for: the span of its positive lines
 * (a renewal line covers exactly the period it bills). Null without one.
 */
export function invoiceServicePeriod(inv: InvoiceLike): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  for (const line of inv.lines?.data ?? []) {
    if (!line?.period || !((line.amount ?? 0) > 0)) continue;
    start = Math.min(start, line.period.start);
    end = Math.max(end, line.period.end);
  }
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

export type ConversionAction = "credit_and_cancel" | "cancel_and_promo" | "cancel_only" | "skip";

export interface ConversionPlan {
  action: ConversionAction;
  creditCents: number;
  amountExTaxCents: number;
  periodStart: number | null;
  periodEnd: number | null;
  reason: string;
}

/** What to do with one subscription. Pure. */
export function planConversion(i: {
  status: string;
  invoices: readonly InvoiceLike[];
  now: number;
}): ConversionPlan {
  const none = { creditCents: 0, amountExTaxCents: 0, periodStart: null, periodEnd: null };
  if (i.status === "trialing") {
    return { action: "cancel_and_promo", ...none, reason: "trial: nothing was paid" };
  }
  if (i.status !== "active" && i.status !== "past_due") {
    return { action: "skip", ...none, reason: `status ${i.status}` };
  }
  const inv = lastPaidInvoice(i.invoices);
  if (!inv) return { action: "cancel_only", ...none, reason: "no paid invoice" };
  const period = invoiceServicePeriod(inv);
  const amountExTaxCents = invoiceAmountExTaxCents(inv);
  if (!period) {
    return {
      action: "cancel_only",
      ...none,
      amountExTaxCents,
      reason: "paid invoice without a service period",
    };
  }
  const creditCents = proratedUnusedCents({
    amountExTaxCents,
    periodStart: period.start,
    periodEnd: period.end,
    now: i.now,
  });
  return {
    action: creditCents > 0 ? "credit_and_cancel" : "cancel_only",
    creditCents,
    amountExTaxCents,
    periodStart: period.start,
    periodEnd: period.end,
    reason: creditCents > 0 ? "unused paid period" : "paid period already used up",
  };
}

/**
 * Whether converting this subscription makes the account "funded" (wallet
 * funded_at: paid tier, never deleted at zero). Only when money was actually
 * paid: a trial or a subscription with no paid invoice (e.g. a 100% creator
 * coupon) stays promo-only, and its users.plan is reset to 'free'. Pure.
 */
export function shouldMarkFunded(plan: ConversionPlan): boolean {
  if (plan.action === "credit_and_cancel") return true;
  return plan.action === "cancel_only" && plan.amountExTaxCents > 0;
}

// ---------------------------------------------------------------------------
// Runner (only when executed directly; tests import the helpers above)
// ---------------------------------------------------------------------------

interface Args {
  apply: boolean;
  only: string | null;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { apply: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") out.apply = true;
    else if (argv[i] === "--only") out.only = argv[++i] ?? null;
  }
  return out;
}

interface Row {
  subscription: string;
  status: string;
  user: string;
  action: ConversionAction;
  paidExTaxEur: string;
  periodEnd: string;
  creditEur: string;
  openInvoices: string;
  funded: string;
  result: string;
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();
  if (!process.env.DATABASE_URL && process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
  }
  if (!process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY) {
    console.error("DATABASE_URL (or DATABASE_URL_UNPOOLED) and STRIPE_SECRET_KEY are required");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));

  // Loaded after the env so getDb()/getStripe() see it.
  const { eq, sql } = await import("drizzle-orm");
  const { getDb } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const { getStripe } = await import("../src/lib/stripe");
  const { credit } = await import("../src/lib/wallet/ledger");
  const { markFunded, auditWallet } = await import("../src/lib/wallet/topup");
  const { notifyWalletState } = await import("../src/lib/wallet/notify");
  const { grantSignupCredit } = await import("../src/lib/wallet/signup-credit");

  const stripe = getStripe();
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const rows: Row[] = [];
  let creditedCents = 0;

  async function userFor(
    customerId: string
  ): Promise<{ id: string; email: string; plan: string } | null> {
    const [row] = await db
      .select({ id: users.id, email: users.email, plan: users.plan })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    if (row) return row;
    const c = await stripe.customers.retrieve(customerId);
    const uid = !c.deleted ? c.metadata?.userId : undefined;
    if (!uid) return null;
    const [byId] = await db
      .select({ id: users.id, email: users.email, plan: users.plan })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    return byId ?? null;
  }

  const subs = [];
  for (const status of ["active", "past_due", "trialing"] as const) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100 })) {
      if (!args.only || sub.id === args.only) subs.push(sub);
    }
  }

  for (const sub of subs) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const user = await userFor(customerId);
    const invoices =
      sub.status === "trialing"
        ? []
        : (await stripe.invoices.list({ subscription: sub.id, status: "paid", limit: 12 })).data;
    const plan = planConversion({ status: sub.status, invoices, now });
    const funds = shouldMarkFunded(plan);
    // Open (unpaid) invoices of a subscription about to be cancelled must not
    // keep being collected after the conversion: they are voided below.
    const openInvoices =
      plan.action === "skip"
        ? []
        : (await stripe.invoices.list({ subscription: sub.id, status: "open", limit: 100 })).data;
    const row: Row = {
      subscription: sub.id,
      status: sub.status,
      user: user?.email ?? `(no user for ${customerId})`,
      action: plan.action,
      paidExTaxEur: (plan.amountExTaxCents / 100).toFixed(2),
      periodEnd: plan.periodEnd ? new Date(plan.periodEnd * 1000).toISOString().slice(0, 10) : "",
      creditEur: (plan.creditCents / 100).toFixed(2),
      openInvoices: openInvoices
        .map((inv) => `${inv.id} €${((inv.amount_due ?? 0) / 100).toFixed(2)}`)
        .join(", "),
      funded: plan.action === "skip" ? "" : funds ? "yes" : "no (plan -> free)",
      result: args.apply ? "" : "dry-run",
    };
    rows.push(row);
    if (!user) {
      row.result = "SKIPPED: no TwinMCP user";
      continue;
    }
    if (!args.apply || plan.action === "skip") continue;

    try {
      const creditedMicros = plan.creditCents * MICROS_PER_CENT;
      let applied = false;
      if (plan.action === "credit_and_cancel") {
        const res = await credit({
          userId: user.id,
          amountMicros: creditedMicros,
          bucket: "paid",
          kind: "subscription_conversion",
          idempotencyKey: `subconv:${sub.id}`,
          stripeRef: sub.id,
          note: "Unused subscription period converted to credit",
          units: {
            source: "subscription_conversion",
            subscriptionId: sub.id,
            amountExTaxCents: plan.amountExTaxCents,
            periodStart: plan.periodStart,
            periodEnd: plan.periodEnd,
          },
        });
        applied = res.applied;
        creditedCents += res.applied ? plan.creditCents : 0;
      }

      // Mark the cancellation as a conversion (read by the webhook's analytics),
      // then cancel now, without proration or refund: the unused part is the
      // credit above.
      await stripe.subscriptions.update(sub.id, { metadata: { walletConversion: "true" } });
      for (const inv of openInvoices) {
        if (inv.id) await stripe.invoices.voidInvoice(inv.id);
      }
      await stripe.subscriptions.cancel(sub.id, { prorate: false, invoice_now: false });

      let promoGranted = false;
      if (plan.action === "cancel_and_promo") {
        // Owner-run, no request IP: the per-IP sign-up limits do not apply
        // (every row here would share the "unknown" bucket). The one-claim-
        // per-email rule still does.
        const g = await grantSignupCredit(
          { userId: user.id, email: user.email, ip: null },
          {
            limits: {
              perIpPerDay: Number.MAX_SAFE_INTEGER,
              perSubnetPerDay: Number.MAX_SAFE_INTEGER,
            },
          }
        );
        promoGranted = g.granted;
      }
      if (funds) {
        // A subscriber who actually paid is a funded account, credit or not.
        await markFunded(user.id);
      } else {
        // Never paid (trial, 100% coupon): the account runs on free credit, so
        // it must not keep the paid tier (50 servers, every box size, the
        // excluded compute MCPs). Unless a top-up already funded the wallet.
        await db
          .update(users)
          .set({ plan: "free" })
          .where(
            sql`${users.id} = ${user.id} and ${users.plan} = 'pro' and not exists (
              select 1 from wallet_accounts w where w.user_id = ${user.id} and w.funded_at is not null
            )`
          );
      }

      auditWallet({
        userId: user.id,
        action: "wallet.subscription_converted",
        targetId: sub.id,
        metadata: {
          status: sub.status,
          creditedMicros: applied ? creditedMicros : 0,
          amountExTaxCents: plan.amountExTaxCents,
          promoGranted,
        },
      });
      await notifyWalletState(user.id, "subscription_converted", {
        creditedMicros: plan.action === "credit_and_cancel" ? creditedMicros : 0,
        amountMicros: plan.action === "credit_and_cancel" ? creditedMicros : 0,
        subscriptionId: sub.id,
        wasTrial: sub.status === "trialing",
        promoGranted,
      });
      row.result =
        plan.action === "credit_and_cancel"
          ? applied
            ? "credited + canceled"
            : "already credited; canceled"
          : promoGranted
            ? "canceled + promo granted"
            : "canceled";
    } catch (err) {
      row.result = `ERROR: ${(err as Error)?.message ?? String(err)}`;
    }
  }

  console.table(rows);
  console.log(
    `${args.apply ? "APPLIED" : "DRY RUN"}: ${rows.length} subscription(s); ` +
      `credit ${args.apply ? "written" : "to write"}: €${(
        (args.apply
          ? creditedCents
          : rows.reduce((s, r) => s + Math.round(Number(r.creditEur) * 100), 0)) / 100
      ).toFixed(2)}`
  );
  if (!args.apply) console.log("Nothing was written. Re-run with --apply to convert.");
  process.exit(rows.some((r) => r.result.startsWith("ERROR")) ? 2 : 0);
}

if (/migrate-pro-to-wallet\.[cm]?[jt]s$/.test(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
