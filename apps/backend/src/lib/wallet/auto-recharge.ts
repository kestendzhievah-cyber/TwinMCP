// Optional auto-recharge (contract W3): when the balance falls below the
// user's threshold, charge the saved card off-session for the configured
// amount, within a monthly cap. Off by default; enabling it requires a saved
// card (app/api/v2/wallet/auto-recharge/route.ts).
//
// Safety:
//   - maybeAutoRecharge never throws (it runs fire-and-forget after a debit);
//   - concurrent triggers are serialized by a per-user transaction-scoped
//     advisory lock (plus an in-process single-flight), and the PaymentIntent
//     carries a Stripe idempotency key derived from the month's recharge count,
//     so a race that slips through still creates ONE charge;
//   - a synchronous success is credited immediately (idempotent on the PI id),
//     so the next debit sees the new balance and does not recharge again; the
//     payment_intent.succeeded webhook then finds the credit already applied;
//   - the monthly cap is the ledger sum of auto_recharge credits in the
//     calendar month (UTC);
//   - a card failure switches auto-recharge OFF and tells the user once;
//   - never for an account without a saved card (promo-only accounts included).

import * as Sentry from "@sentry/nextjs";
import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { creditLedger, walletAccounts } from "@/db/schema/wallet";
import { getStripe, TAX_ENABLED } from "@/lib/stripe";
import { PRICING, eurToMicros } from "@/lib/wallet/pricing";
import { credit, getWallet } from "@/lib/wallet/ledger";
import { notifyWalletState } from "@/lib/wallet/notify";
import {
  AUTO_RECHARGE_KIND,
  MICROS_PER_CENT,
  auditWallet,
  markFunded,
  topupTaxBehavior,
  topupTaxCode,
} from "@/lib/wallet/topup";
import { trackServer } from "@/lib/analytics/server";

// ---------------------------------------------------------------------------
// Settings rules (pure, unit-tested)
// ---------------------------------------------------------------------------

export const AUTO_RECHARGE_LIMITS = {
  minThresholdEur: 2,
  maxThresholdEur: 500,
  /** Same floor as a manual top-up (card fees make smaller charges uneconomic). */
  minAmountEur: PRICING.minTopupEur,
  maxAmountEur: PRICING.maxTopupEur,
  maxMonthlyCapEur: 5000,
} as const;

export interface AutoRechargeSettings {
  enabled: boolean;
  thresholdMicros: number;
  amountMicros: number;
  monthlyCapMicros: number;
}

export interface AutoRechargePatch {
  enabled?: boolean;
  thresholdEur?: number;
  amountEur?: number;
  monthlyCapEur?: number;
}

/** Up to two decimals (cents), finite. */
function isCentAmount(n: number): boolean {
  return Number.isFinite(n) && Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

/**
 * Merge a settings patch over the current settings and check the result:
 * threshold ≥ €2 (cents allowed), amount ≥ the minimum top-up (whole euros),
 * monthly cap ≥ amount (whole euros). Validated on the MERGED settings, so
 * lowering the cap below an existing amount is refused too.
 */
export function applyAutoRechargePatch(
  current: AutoRechargeSettings,
  patch: AutoRechargePatch,
  limits: {
    minThresholdEur: number;
    maxThresholdEur: number;
    minAmountEur: number;
    maxAmountEur: number;
    maxMonthlyCapEur: number;
  } = AUTO_RECHARGE_LIMITS
): { ok: true; next: AutoRechargeSettings } | { ok: false; message: string } {
  const next: AutoRechargeSettings = { ...current };
  if (patch.thresholdEur !== undefined) {
    const t = patch.thresholdEur;
    if (!isCentAmount(t) || t < limits.minThresholdEur || t > limits.maxThresholdEur) {
      return {
        ok: false,
        message: `The threshold must be between €${limits.minThresholdEur} and €${limits.maxThresholdEur}`,
      };
    }
    next.thresholdMicros = eurToMicros(t);
  }
  if (patch.amountEur !== undefined) {
    const a = patch.amountEur;
    if (!Number.isInteger(a) || a < limits.minAmountEur || a > limits.maxAmountEur) {
      return {
        ok: false,
        message: `The recharge amount must be a whole number of euros between €${limits.minAmountEur} and €${limits.maxAmountEur}`,
      };
    }
    next.amountMicros = eurToMicros(a);
  }
  if (patch.monthlyCapEur !== undefined) {
    const c = patch.monthlyCapEur;
    if (!Number.isInteger(c) || c <= 0 || c > limits.maxMonthlyCapEur) {
      return {
        ok: false,
        message: `The monthly cap must be a whole number of euros up to €${limits.maxMonthlyCapEur}`,
      };
    }
    next.monthlyCapMicros = eurToMicros(c);
  }
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (next.monthlyCapMicros < next.amountMicros) {
    return { ok: false, message: "The monthly cap must be at least the recharge amount" };
  }
  return { ok: true, next };
}

export type AutoRechargeDecision =
  | { charge: true; amountMicros: number }
  | { charge: false; reason: "disabled" | "no_card" | "above_threshold" | "monthly_cap" };

/**
 * Whether to recharge now, and for how much: the configured amount, trimmed
 * to what the monthly cap still allows (whole cents), and only when that is at
 * least the minimum top-up. Triggers when the total balance is BELOW the
 * threshold.
 */
export function planAutoRecharge(i: {
  enabled: boolean;
  hasCard: boolean;
  totalMicros: number;
  thresholdMicros: number;
  amountMicros: number;
  monthlyCapMicros: number;
  monthRechargedMicros: number;
  minMicros: number;
}): AutoRechargeDecision {
  if (!i.enabled) return { charge: false, reason: "disabled" };
  if (!i.hasCard) return { charge: false, reason: "no_card" };
  if (i.totalMicros >= i.thresholdMicros) return { charge: false, reason: "above_threshold" };
  const room = i.monthlyCapMicros - Math.max(0, i.monthRechargedMicros);
  const raw = Math.min(i.amountMicros, room);
  const amount = Math.floor(raw / MICROS_PER_CENT) * MICROS_PER_CENT;
  if (amount < i.minMicros || amount <= 0) return { charge: false, reason: "monthly_cap" };
  return { charge: true, amountMicros: amount };
}

/** First instant of the calendar month (UTC) containing `now`. */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Stripe idempotency key of the n-th recharge of a month, within a 10-minute
 * window: two racing triggers share it (one charge), the next recharge after
 * a success gets a new n, and a retry after a failure gets a new window.
 */
export function autoRechargeIdempotencyKey(userId: string, now: Date, monthCount: number): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const window = Math.floor(now.getTime() / 600_000);
  return `twinmcp-ar:${userId}:${month}:${monthCount}:${window}`;
}

/** A Stripe error that means the card itself was refused (vs. a transient outage). */
export function isCardFailure(err: unknown): boolean {
  const e = err as { type?: unknown; code?: unknown } | null;
  if (!e || typeof e !== "object") return false;
  if (e.type === "StripeCardError") return true;
  return (
    e.code === "authentication_required" ||
    e.code === "card_declined" ||
    e.code === "expired_card" ||
    e.code === "payment_method_unactivated" ||
    e.code === "resource_missing"
  );
}

// ---------------------------------------------------------------------------
// Settings I/O
// ---------------------------------------------------------------------------

export interface AutoRechargeState extends AutoRechargeSettings {
  paymentMethodId: string | null;
}

export async function getAutoRechargeState(userId: string): Promise<AutoRechargeState> {
  const [row] = await getDb()
    .select({
      enabled: walletAccounts.autoRechargeEnabled,
      thresholdMicros: walletAccounts.autoRechargeThresholdMicros,
      amountMicros: walletAccounts.autoRechargeAmountMicros,
      monthlyCapMicros: walletAccounts.autoRechargeMonthlyCapMicros,
      paymentMethodId: walletAccounts.stripePaymentMethodId,
    })
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);
  if (!row) {
    return {
      enabled: false,
      thresholdMicros: 5_000_000,
      amountMicros: 20_000_000,
      monthlyCapMicros: 100_000_000,
      paymentMethodId: null,
    };
  }
  return {
    enabled: row.enabled,
    thresholdMicros: Number(row.thresholdMicros),
    amountMicros: Number(row.amountMicros),
    monthlyCapMicros: Number(row.monthlyCapMicros),
    paymentMethodId: row.paymentMethodId ?? null,
  };
}

export async function saveAutoRechargeSettings(
  userId: string,
  s: AutoRechargeSettings
): Promise<void> {
  const values = {
    autoRechargeEnabled: s.enabled,
    autoRechargeThresholdMicros: s.thresholdMicros,
    autoRechargeAmountMicros: s.amountMicros,
    autoRechargeMonthlyCapMicros: s.monthlyCapMicros,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(walletAccounts)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: walletAccounts.userId, set: values });
}

/** Auto-recharge credits this calendar month: { count, micros }. */
export async function monthAutoRecharges(
  userId: string,
  now: Date = new Date()
): Promise<{ count: number; micros: number }> {
  const [row] = await getDb()
    .select({
      n: count(),
      total: sql<string>`coalesce(sum(${creditLedger.deltaMicros}), 0)::text`,
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.kind, "auto_recharge"),
        gte(creditLedger.createdAt, monthStartUtc(now))
      )
    );
  return { count: Number(row?.n ?? 0), micros: Number(row?.total ?? 0) };
}

/** wallet_accounts.notified key of an auto-recharge PaymentIntent still settling. */
export const PENDING_KEY = "auto_recharge_pending";
/** A marker older than this is stale (a lost webhook) and no longer blocks. */
export const PENDING_MAX_AGE_MS = 7 * 86_400_000;

/** Whether a still-settling auto-recharge blocks a new one. Pure. */
export function pendingAutoRecharge(notified: unknown, now: Date): boolean {
  const v = (notified as Record<string, unknown> | null | undefined)?.[PENDING_KEY] as
    | { at?: unknown }
    | undefined;
  if (!v || typeof v.at !== "string") return false;
  const at = Date.parse(v.at);
  return Number.isFinite(at) && now.getTime() - at < PENDING_MAX_AGE_MS;
}

// ---------------------------------------------------------------------------
// Reconciliation of a still-pending recharge (lost webhook)
// ---------------------------------------------------------------------------
//
// The marker is written when a PaymentIntent comes back "processing"; the
// payment_intent.succeeded / payment_failed webhook settles and clears it. If
// that webhook is lost, the marker would block every new recharge for
// PENDING_MAX_AGE_MS. The enforce pass (compute-meter runWalletEnforce) asks
// Stripe directly instead, once the webhook had a fair chance.

/** Let the webhook settle first: a marker younger than this is left alone. */
export const RECONCILE_MIN_AGE_MS = 15 * 60_000;
/** A PaymentIntent still "processing" after this no longer blocks a new recharge. */
export const PROCESSING_MAX_AGE_MS = 24 * 3_600_000;

export interface PendingMarker {
  /** PaymentIntent id, or null for a malformed marker. */
  pi: string | null;
  at: Date | null;
}

/** The pending marker stored in wallet_accounts.notified, or null when none. Pure. */
export function readPendingMarker(notified: unknown): PendingMarker | null {
  if (!notified || typeof notified !== "object" || Array.isArray(notified)) return null;
  const v = (notified as Record<string, unknown>)[PENDING_KEY];
  if (v === undefined || v === null) return null;
  const rec = typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const pi = typeof rec.pi === "string" && rec.pi.startsWith("pi_") ? rec.pi : null;
  const ms = typeof rec.at === "string" ? Date.parse(rec.at) : NaN;
  return { pi, at: Number.isFinite(ms) ? new Date(ms) : null };
}

export type ReconcileDecision =
  /** Too early, or Stripe says it is still settling: leave the marker. */
  | { action: "wait" }
  /** Ask Stripe for the PaymentIntent's status. */
  | { action: "retrieve"; pi: string }
  /** Succeeded: credit it (idempotent, same key as the webhook) and clear. */
  | { action: "credit"; pi: string }
  /** Failed or canceled: clear the marker, switch auto-recharge off, tell the user. */
  | { action: "fail"; pi: string; reason: string }
  /** Malformed, unknown to Stripe, not ours, or processing for too long: clear the marker only. */
  | { action: "clear"; reason: "malformed" | "not_found" | "stale_processing" | "foreign" };

const FAILED_PI_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "requires_payment_method",
  // Off-session: nobody is there to authenticate, so it never completes.
  "requires_action",
]);

/**
 * What to do with a pending marker. Pure. Called twice: first without
 * `stripe` (should we ask Stripe at all?), then with what Stripe returned:
 * `status` (null when Stripe does not know the PaymentIntent) and whether the
 * PaymentIntent really is this user's auto-recharge (`ours`).
 */
export function decidePendingReconcile(
  marker: PendingMarker,
  now: Date,
  stripe?: { status: string | null; ours: boolean }
): ReconcileDecision {
  if (!marker.pi || !marker.at) return { action: "clear", reason: "malformed" };
  const age = now.getTime() - marker.at.getTime();
  if (!stripe) {
    return age < RECONCILE_MIN_AGE_MS ? { action: "wait" } : { action: "retrieve", pi: marker.pi };
  }
  if (stripe.status === null) return { action: "clear", reason: "not_found" };
  if (!stripe.ours) return { action: "clear", reason: "foreign" };
  if (stripe.status === "succeeded") return { action: "credit", pi: marker.pi };
  if (FAILED_PI_STATUSES.has(stripe.status)) {
    return { action: "fail", pi: marker.pi, reason: stripe.status };
  }
  // processing / requires_confirmation / requires_capture: still settling.
  return age > PROCESSING_MAX_AGE_MS
    ? { action: "clear", reason: "stale_processing" }
    : { action: "wait" };
}

/**
 * Clear the marker only if it still names this PaymentIntent, so a late
 * webhook or reconcile for an older PI never clears a newer, still-processing
 * one (which would let a second recharge start). pi = null clears whatever
 * marker is there (a failure with no PaymentIntent).
 */
async function clearPendingMarkerFor(userId: string, pi: string | null): Promise<void> {
  await getDb()
    .update(walletAccounts)
    .set({ notified: sql`${walletAccounts.notified} - ${PENDING_KEY}`, updatedAt: new Date() })
    .where(
      and(
        eq(walletAccounts.userId, userId),
        pi === null
          ? sql`(${walletAccounts.notified} -> ${PENDING_KEY}::text) is not null`
          : sql`(${walletAccounts.notified} -> ${PENDING_KEY}::text ->> 'pi') = ${pi}::text`
      )
    );
}

export interface ReconcileResult {
  checked: number;
  credited: number;
  failed: number;
  cleared: number;
  errors: number;
}

/**
 * Settle auto-recharges whose webhook never arrived (wallet-enforce pass).
 * Succeeded → credited through settleAutoRecharge (idempotency key
 * `autorecharge:<pi>`, the webhook's own, so a late webhook is a no-op);
 * failed / canceled → failAutoRecharge (clears the marker, switches
 * auto-recharge off, emails once); still processing after
 * PROCESSING_MAX_AGE_MS → marker cleared (a later webhook still credits it).
 * Never throws; a per-user error is counted and the next pass retries.
 */
export async function reconcilePendingAutoRecharges(
  now: Date = new Date(),
  limit = 100
): Promise<ReconcileResult> {
  const out: ReconcileResult = { checked: 0, credited: 0, failed: 0, cleared: 0, errors: 0 };
  if (!process.env.STRIPE_SECRET_KEY) return out;
  let rows: Array<{ userId: string; notified: Record<string, unknown> | null }>;
  try {
    rows = await getDb()
      .select({ userId: walletAccounts.userId, notified: walletAccounts.notified })
      .from(walletAccounts)
      .where(sql`(${walletAccounts.notified} -> ${PENDING_KEY}::text) is not null`)
      .limit(limit);
  } catch (err) {
    console.error("[wallet/auto-recharge] reconcile read failed:", err);
    out.errors++;
    return out;
  }

  for (const row of rows) {
    const marker = readPendingMarker(row.notified);
    if (!marker) continue;
    try {
      let decision = decidePendingReconcile(marker, now);
      let pi: Stripe.PaymentIntent | null = null;
      if (decision.action === "retrieve") {
        out.checked++;
        try {
          pi = await getStripe().paymentIntents.retrieve(decision.pi);
        } catch (err) {
          if ((err as { code?: unknown } | null)?.code !== "resource_missing") throw err;
        }
        decision = decidePendingReconcile(marker, now, {
          status: pi?.status ?? null,
          ours:
            !!pi && pi.metadata?.kind === AUTO_RECHARGE_KIND && pi.metadata?.userId === row.userId,
        });
      }
      switch (decision.action) {
        case "wait":
        case "retrieve":
          break;
        case "credit":
          if (pi) {
            await settleAutoRecharge(pi); // credits idempotently, then clears the marker
            out.credited++;
          }
          break;
        case "fail":
          await failAutoRecharge(row.userId, `payment_${decision.reason}`, decision.pi);
          // failAutoRecharge clears it too; this also covers a wallet whose
          // auto-recharge was already off (no email then: nothing changed).
          await clearPendingMarkerFor(row.userId, decision.pi);
          out.failed++;
          break;
        case "clear":
          await clearPendingMarkerFor(row.userId, marker.pi);
          console.warn(
            `[wallet/auto-recharge] pending marker cleared for ${row.userId} (${decision.reason}, ${marker.pi ?? "no PaymentIntent"})`
          );
          Sentry.captureMessage(
            `auto-recharge pending marker cleared: ${decision.reason}`,
            "warning"
          );
          out.cleared++;
          break;
      }
    } catch (err) {
      out.errors++;
      console.error(`[wallet/auto-recharge] reconcile ${row.userId} failed:`, err);
      Sentry.captureException(err, { tags: { area: "wallet", stage: "auto-recharge-reconcile" } });
    }
  }
  return out;
}

/**
 * Retry auto-recharge for enabled wallets still below their threshold (cron).
 * maybeAutoRecharge only runs when a debit crosses a line, so a transient
 * Stripe error would otherwise leave the wallet running dry with
 * auto-recharge "on". maybeAutoRecharge re-checks everything under its lock.
 */
export async function retryDueAutoRecharges(limit = 200): Promise<number> {
  if (!process.env.STRIPE_SECRET_KEY) return 0;
  const rows = await getDb()
    .select({ userId: walletAccounts.userId })
    .from(walletAccounts)
    .where(
      and(
        eq(walletAccounts.autoRechargeEnabled, true),
        isNotNull(walletAccounts.stripePaymentMethodId),
        sql`${walletAccounts.paidMicros} + ${walletAccounts.promoMicros} < ${walletAccounts.autoRechargeThresholdMicros}`
      )
    )
    .limit(limit);
  for (const r of rows) await maybeAutoRecharge(r.userId);
  return rows.length;
}

/**
 * Switch auto-recharge off after a card failure, and tell the user once (only
 * the call that actually flipped it sends the email). Never throws.
 */
export async function failAutoRecharge(
  userId: string,
  reason: string,
  ref?: string | null
): Promise<void> {
  try {
    await clearPendingMarkerFor(userId, ref ?? null);
    const flipped = await getDb()
      .update(walletAccounts)
      .set({ autoRechargeEnabled: false, updatedAt: new Date() })
      .where(and(eq(walletAccounts.userId, userId), eq(walletAccounts.autoRechargeEnabled, true)))
      .returning({ userId: walletAccounts.userId });
    if (flipped.length === 0) return;
    auditWallet({
      userId,
      action: "wallet.auto_recharge_failed",
      targetId: ref ?? null,
      metadata: { reason },
    });
    trackServer({ event: "auto_recharge_failed", distinctId: userId, properties: { reason } });
    await notifyWalletState(userId, "auto_recharge_failed", { reason });
  } catch (err) {
    console.error("[wallet/auto-recharge] could not record the failure:", err);
    Sentry.captureException(err, { tags: { area: "wallet", stage: "auto-recharge-fail" } });
  }
}

/**
 * Credit a succeeded auto-recharge PaymentIntent. Idempotent on the PI id, so
 * the synchronous path and the payment_intent.succeeded webhook can both call
 * it. Throws on a DB error (the webhook then retries).
 */
export async function settleAutoRecharge(pi: Stripe.PaymentIntent): Promise<void> {
  if (pi.status !== "succeeded" || pi.metadata?.kind !== AUTO_RECHARGE_KIND) return;
  const userId = pi.metadata.userId;
  const amountMicros = Number(pi.metadata.amountMicros);
  if (!userId || !Number.isInteger(amountMicros) || amountMicros <= 0) {
    console.error("[wallet/auto-recharge] succeeded PI without usable metadata", pi.id);
    return;
  }
  const taxCents = Number(pi.metadata.taxCents ?? 0) || 0;
  const res = await credit({
    userId,
    amountMicros,
    bucket: "paid",
    kind: "auto_recharge",
    idempotencyKey: `autorecharge:${pi.id}`,
    stripeRef: pi.id,
    note: "Auto-recharge",
    units: {
      source: "auto_recharge",
      paymentIntentId: pi.id,
      grossCents: pi.amount_received || pi.amount,
      taxCents,
      currency: pi.currency,
    },
  });
  await markFunded(userId);
  await clearPendingMarkerFor(userId, pi.id);

  const calculation = pi.metadata.taxCalculation;
  if (calculation) {
    // Records the tax for reporting (Stripe Tax custom flow). A duplicate
    // reference on a second call is expected and harmless.
    await getStripe()
      .tax.transactions.createFromCalculation({ calculation, reference: pi.id })
      .catch((err) => console.warn("[wallet/auto-recharge] tax transaction:", err?.message));
  }

  if (!res.applied) return;
  auditWallet({
    userId,
    action: "wallet.auto_recharge",
    targetId: pi.id,
    metadata: { amountMicros, taxCents, totalMicros: res.totalMicros },
  });
  const amount = amountMicros / 1_000_000;
  trackServer({
    event: "wallet_topup",
    distinctId: userId,
    properties: { amount, currency: "eur", $revenue: amount, source: "auto_recharge" },
  });
  void notifyWalletState(userId, "topup_succeeded", {
    amountMicros,
    totalMicros: res.totalMicros,
    source: "auto_recharge",
    paymentIntentId: pi.id,
  }).catch((err) => console.warn("[wallet/auto-recharge] notify failed:", err));
}

// ---------------------------------------------------------------------------
// The trigger
// ---------------------------------------------------------------------------

const inFlight = new Set<string>();

function nullToUndefined<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

/** Tax on `netCents` of credit for this card's billing address (Stripe Tax custom flow). */
async function taxFor(
  stripe: Stripe,
  customerId: string,
  pm: Stripe.PaymentMethod,
  netCents: number
): Promise<{ grossCents: number; taxCents: number; calculationId: string | null }> {
  const addr = pm.billing_details?.address;
  const taxCode = topupTaxCode();
  const calc = await stripe.tax.calculations.create({
    currency: "eur",
    line_items: [
      {
        amount: netCents,
        reference: "twinmcp-credit",
        tax_behavior: topupTaxBehavior(),
        ...(taxCode ? { tax_code: taxCode } : {}),
      },
    ],
    ...(addr?.country
      ? {
          customer_details: {
            address: {
              country: addr.country,
              line1: nullToUndefined(addr.line1),
              line2: nullToUndefined(addr.line2),
              city: nullToUndefined(addr.city),
              postal_code: nullToUndefined(addr.postal_code),
              state: nullToUndefined(addr.state),
            },
            address_source: "billing" as const,
          },
        }
      : { customer: customerId }),
  });
  const taxCents = (calc.tax_amount_exclusive ?? 0) + (calc.tax_amount_inclusive ?? 0);
  return { grossCents: calc.amount_total, taxCents, calculationId: calc.id ?? null };
}

/**
 * Recharge the wallet if it is enabled, a card is saved, the balance is below
 * the threshold and the monthly cap allows it. Fire-and-forget: never throws.
 */
export async function maybeAutoRecharge(userId: string): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return;
  if (inFlight.has(userId)) return;
  inFlight.add(userId);
  try {
    // Cheap pre-check outside any lock: most debits stop here.
    const pre = await getAutoRechargeState(userId);
    if (!pre.enabled || !pre.paymentMethodId) return;

    await getDb().transaction(async (tx) => {
      const lockRows = (await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtext(${`wallet_auto_recharge:${userId}`})) AS locked`
      )) as unknown as Array<{ locked: boolean }>;
      if (!lockRows[0]?.locked) return; // another trigger is charging right now

      const now = new Date();
      const [state, wallet, month, [user]] = await Promise.all([
        getAutoRechargeState(userId),
        getWallet(userId),
        monthAutoRecharges(userId, now),
        getDb()
          .select({ customerId: users.stripeCustomerId, email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
      ]);
      // A recharge still settling (async payment) blocks a new one: it would
      // otherwise escape the monthly cap, which counts only credited rows.
      const [marker] = await tx
        .select({ notified: walletAccounts.notified })
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, userId))
        .limit(1);
      if (pendingAutoRecharge(marker?.notified, now)) return;

      const decision = planAutoRecharge({
        enabled: state.enabled,
        hasCard: !!state.paymentMethodId && !!user?.customerId,
        totalMicros: wallet.totalMicros,
        thresholdMicros: state.thresholdMicros,
        amountMicros: state.amountMicros,
        monthlyCapMicros: state.monthlyCapMicros,
        monthRechargedMicros: month.micros,
        minMicros: eurToMicros(PRICING.minTopupEur),
      });
      if (!decision.charge || !user?.customerId || !state.paymentMethodId) return;

      const stripe = getStripe();
      // Off-session recharges are card-only: a delayed method (SEPA…) would
      // leave PaymentIntents "processing" for days.
      const pm = await stripe.paymentMethods.retrieve(state.paymentMethodId);
      if (pm.type !== "card") {
        await failAutoRecharge(userId, "unsupported_payment_method", null);
        return;
      }
      const netCents = decision.amountMicros / MICROS_PER_CENT;
      let grossCents = netCents;
      let taxCents = 0;
      let calculationId: string | null = null;
      if (TAX_ENABLED) {
        ({ grossCents, taxCents, calculationId } = await taxFor(
          stripe,
          user.customerId,
          pm,
          netCents
        ));
      }
      const creditedMicros = (grossCents - taxCents) * MICROS_PER_CENT;
      if (creditedMicros <= 0) return;

      const email =
        user.email && !user.email.endsWith("@placeholder.twinmcp.fr") ? user.email : null;
      const pi = await stripe.paymentIntents.create(
        {
          amount: grossCents,
          currency: "eur",
          customer: user.customerId,
          payment_method: state.paymentMethodId,
          off_session: true,
          confirm: true,
          description: "TwinMCP credit auto-recharge",
          ...(email ? { receipt_email: email } : {}),
          metadata: {
            kind: AUTO_RECHARGE_KIND,
            userId,
            amountMicros: String(creditedMicros),
            netCents: String(grossCents - taxCents),
            taxCents: String(taxCents),
            ...(calculationId ? { taxCalculation: calculationId } : {}),
          },
        },
        { idempotencyKey: autoRechargeIdempotencyKey(userId, now, month.count) }
      );

      if (pi.status === "succeeded") {
        await settleAutoRecharge(pi);
      } else if (pi.status === "requires_action" || pi.status === "requires_payment_method") {
        await failAutoRecharge(userId, pi.last_payment_error?.code ?? pi.status, pi.id);
      }
      if (pi.status === "processing") {
        // The payment_intent.succeeded / payment_failed webhook settles it;
        // until then no other recharge starts.
        await tx
          .update(walletAccounts)
          .set({
            notified: sql`${walletAccounts.notified} || ${JSON.stringify({
              [PENDING_KEY]: { pi: pi.id, amountMicros: creditedMicros, at: now.toISOString() },
            })}::jsonb`,
          })
          .where(eq(walletAccounts.userId, userId));
      }
    });
  } catch (err) {
    if (isCardFailure(err)) {
      const e = err as { code?: string; payment_intent?: { id?: string } };
      await failAutoRecharge(userId, e.code ?? "card_declined", e.payment_intent?.id ?? null);
    } else {
      console.error("[wallet/auto-recharge] skipped:", err);
      Sentry.captureException(err, { tags: { area: "wallet", stage: "auto-recharge" } });
    }
  } finally {
    inFlight.delete(userId);
  }
}
