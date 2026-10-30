// Wallet top-ups through Stripe Checkout (contract W3), and the webhook-side
// money paths that belong to them: crediting a paid top-up, saving a card,
// clawing credit back on a refund or a dispute.
//
// Money rules:
//   - amounts are whole euros on the way in (min/max from PRICING) and integer
//     micro-euros in the ledger (€1 = 1_000_000, 1 cent = 10_000 micros);
//   - what is credited is what the customer paid EXCLUDING tax, read from the
//     completed session (amount_total - amount_tax), never more than the amount
//     the session was opened for;
//   - every ledger write carries an idempotency key derived from a Stripe id, so
//     a retried or duplicated webhook is a no-op (the ledger's unique key);
//   - a top-up is credited to the PAID bucket; clawbacks take from PAID only.

import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { and, eq, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { creditLedger, walletAccounts } from "@/db/schema/wallet";
import { getOrCreateCustomer, getStripe, TAX_ENABLED } from "@/lib/stripe";
import {
  attributionMetadata,
  cardSetupReturnUrls,
  topupReturnUrls,
} from "@/lib/billing/checkout-helpers";
import { PRICING, eurToMicros, type Pricing } from "@/lib/wallet/pricing";
import { credit, debit, type DebitInput, type DebitResult, type Tx } from "@/lib/wallet/ledger";
import { notifyWalletState } from "@/lib/wallet/notify";
import { afterBalanceChange } from "@/lib/wallet/after-debit";
import { trackServer } from "@/lib/analytics/server";

export const MICROS_PER_CENT = 10_000;

/** Stripe metadata `kind` values this module writes and the webhook routes on. */
export const TOPUP_KIND = "wallet_topup";
export const CARD_SETUP_KIND = "wallet_card";
export const AUTO_RECHARGE_KIND = "auto_recharge";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in __tests__/wallet-topup.test.ts)
// ---------------------------------------------------------------------------

export type TopupAmountCheck =
  | { ok: true; amountEur: number; amountCents: number; amountMicros: number }
  | { ok: false; message: string };

/**
 * A top-up amount: whole euros, between PRICING.minTopupEur and maxTopupEur.
 * Presets (10/25/50/100) are just common values of the same rule; any custom
 * integer in range is accepted. Accepts a number or a digits-only string (the
 * GET start route reads it from a query string).
 */
export function parseTopupAmount(
  raw: unknown,
  p: Pick<Pricing, "minTopupEur" | "maxTopupEur"> = PRICING
): TopupAmountCheck {
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string" && /^\s*\d{1,7}\s*$/.test(raw)) n = Number(raw.trim());
  else return { ok: false, message: "Amount must be a whole number of euros" };
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, message: "Amount must be a whole number of euros" };
  }
  if (n < p.minTopupEur) return { ok: false, message: `The minimum top-up is €${p.minTopupEur}` };
  if (n > p.maxTopupEur) return { ok: false, message: `The maximum top-up is €${p.maxTopupEur}` };
  return { ok: true, amountEur: n, amountCents: n * 100, amountMicros: eurToMicros(n) };
}

/**
 * Whether top-up prices are tax-exclusive (default: €10 of credit costs €10 +
 * VAT where Stripe Tax applies it) or tax-inclusive (€10 charged, the credit is
 * €10 minus the VAT in it). Only matters when STRIPE_TAX_ENABLED=true.
 */
export function topupTaxBehavior(
  env: Record<string, string | undefined> = process.env
): "exclusive" | "inclusive" {
  return env.WALLET_TOPUP_TAX_BEHAVIOR === "inclusive" ? "inclusive" : "exclusive";
}

/** Optional Stripe product tax code for credit (e.g. txcd_10000000), from the env. */
export function topupTaxCode(env: Record<string, string | undefined> = process.env): string | null {
  const code = env.STRIPE_TOPUP_TAX_CODE?.trim();
  return code && /^txcd_\d+$/.test(code) ? code : null;
}

export interface SessionAmounts {
  amount_total: number | null;
  total_details?: { amount_tax?: number | null } | null;
}

/**
 * Cents to credit for a paid top-up session: what was charged minus the tax in
 * it, capped at the amount the session was opened for (so a misconfigured tax
 * setting can never credit more than was bought). Never negative.
 */
export function netCreditCents(session: SessionAmounts, expectedCents: number): number {
  const gross = Math.max(0, Math.trunc(session.amount_total ?? 0));
  const tax = Math.max(0, Math.trunc(session.total_details?.amount_tax ?? 0));
  const net = Math.max(0, gross - tax);
  return expectedCents > 0 ? Math.min(net, Math.trunc(expectedCents)) : net;
}

export interface SessionRoutingFields {
  mode: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string> | null;
}

/**
 * What the webhook does with a checkout.session.completed /
 * async_payment_succeeded event:
 *   credit        a paid wallet top-up
 *   await_payment a wallet top-up whose payment is still pending (SEPA…): the
 *                 async_payment_succeeded event credits it later
 *   save_card     a setup-mode session that saved a card for auto-recharge
 *   legacy        a subscription checkout (retired, kept for in-flight sessions)
 *   ignore        anything else
 */
export type WalletSessionAction = "credit" | "await_payment" | "save_card" | "legacy" | "ignore";

export function walletSessionAction(session: SessionRoutingFields): WalletSessionAction {
  const kind = session.metadata?.kind;
  if (session.mode === "payment" && kind === TOPUP_KIND) {
    if (session.payment_status === "paid") return "credit";
    if (session.payment_status === "unpaid") return "await_payment";
    return "ignore";
  }
  if (session.mode === "setup" && kind === CARD_SETUP_KIND) return "save_card";
  if (session.mode === "subscription") return "legacy";
  return "ignore";
}

/** The wallet kind of a PaymentIntent (from its metadata), or null when it is not ours. */
export function walletPaymentIntentKind(pi: {
  metadata?: Record<string, string> | null;
}): typeof TOPUP_KIND | typeof AUTO_RECHARGE_KIND | null {
  const kind = pi.metadata?.kind;
  return kind === TOPUP_KIND || kind === AUTO_RECHARGE_KIND ? kind : null;
}

/** A ledger row as the clawback math reads it. */
export interface PaymentLedgerRow {
  kind: string;
  deltaMicros: number;
  units: Record<string, unknown> | null;
}

export interface PaymentLedgerSummary {
  /** Credit bought by this payment (top-up / auto-recharge rows). */
  creditedMicros: number;
  /** Gross amount charged, in cents, as recorded on the credit row (0 when unknown). */
  grossCents: number;
  /** Clawed back so far because of refunds. */
  clawedByRefundMicros: number;
  /** Clawed back so far for any reason, net of disputes later won. */
  clawedTotalMicros: number;
}

/** Fold the ledger rows of one payment into what is still clawable. Pure. */
export function summarizePaymentLedger(rows: readonly PaymentLedgerRow[]): PaymentLedgerSummary {
  let creditedMicros = 0;
  let grossCents = 0;
  let clawedByRefundMicros = 0;
  let clawedTotalMicros = 0;
  for (const r of rows) {
    const source = r.units && typeof r.units.source === "string" ? r.units.source : null;
    if (r.kind === "topup" || r.kind === "auto_recharge") {
      creditedMicros += r.deltaMicros;
      const g = Number(r.units?.grossCents);
      if (Number.isFinite(g) && g > 0) grossCents += Math.trunc(g);
    } else if (r.kind === "clawback") {
      clawedTotalMicros += -r.deltaMicros;
      if (source === "refund") clawedByRefundMicros += -r.deltaMicros;
    } else if (r.kind === "adjustment" && source === "dispute_won") {
      clawedTotalMicros -= r.deltaMicros;
    }
  }
  return {
    creditedMicros,
    grossCents,
    clawedByRefundMicros,
    clawedTotalMicros: Math.max(0, clawedTotalMicros),
  };
}

/**
 * Credit to claw back after a (possibly partial, possibly repeated) refund.
 * Stripe reports the CUMULATIVE amount refunded on the charge, so the target is
 * the credited amount times the refunded share, minus what earlier refunds
 * already took; never more than what is left of the purchase.
 */
export function refundClawbackMicros(i: {
  grossCents: number;
  refundedCents: number;
  creditedMicros: number;
  clawedByRefundMicros: number;
  clawedTotalMicros: number;
}): number {
  if (!(i.grossCents > 0) || !(i.creditedMicros > 0) || !(i.refundedCents > 0)) return 0;
  const share = Math.min(i.refundedCents, i.grossCents);
  const target = Math.round((i.creditedMicros * share) / i.grossCents);
  const want = target - i.clawedByRefundMicros;
  const remaining = i.creditedMicros - i.clawedTotalMicros;
  return Math.max(0, Math.min(want, remaining));
}

/** Credit to claw back when a dispute opens on a top-up charge. */
export function disputeClawbackMicros(i: {
  grossCents: number;
  disputedCents: number;
  creditedMicros: number;
  clawedTotalMicros: number;
}): number {
  if (!(i.grossCents > 0) || !(i.creditedMicros > 0) || !(i.disputedCents > 0)) return 0;
  const share = Math.min(i.disputedCents, i.grossCents);
  const target = Math.round((i.creditedMicros * share) / i.grossCents);
  const remaining = i.creditedMicros - i.clawedTotalMicros;
  return Math.max(0, Math.min(target, remaining));
}

/** Stripe id of an expandable field (string id or expanded object). */
export function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

// ---------------------------------------------------------------------------
// Shared side effects
// ---------------------------------------------------------------------------

export type WalletAuditAction =
  | "wallet.topup"
  | "wallet.auto_recharge"
  | "wallet.auto_recharge_failed"
  | "wallet.card_saved"
  | "wallet.clawback"
  | "wallet.dispute_won"
  | "wallet.subscription_converted";

/**
 * Append a wallet row to audit_logs. lib/audit.ts types its action union
 * without wallet actions, so this writes the same table directly. Never
 * throws, never blocks the caller.
 */
export function auditWallet(entry: {
  userId: string;
  action: WalletAuditAction;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  void getDb()
    .insert(auditLogs)
    .values({
      id: randomUUID(),
      userId: entry.userId,
      action: entry.action,
      targetType: "wallet",
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    })
    .catch((err) => console.error("[wallet audit] failed to persist", entry.action, err));
}

/**
 * First paid money in: the account becomes "funded / pay-as-you-go", stored as
 * users.plan = 'pro' (value kept for backward compatibility). Only a 'free'
 * account moves; a grandfathered 'team' account is left alone, and billing
 * never moves a plan down any more. funded_at is set by the ledger on the
 * first funding credit; the COALESCE here is a backstop. Returns whether the
 * plan changed (the first funding).
 */
export async function markFunded(userId: string): Promise<boolean> {
  const db = getDb();
  await db
    .update(walletAccounts)
    .set({ fundedAt: sql`COALESCE(${walletAccounts.fundedAt}, now())` })
    .where(eq(walletAccounts.userId, userId));
  const flipped = await db
    .update(users)
    .set({ plan: "pro", updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.plan, "free")))
    .returning({ id: users.id });
  return flipped.length > 0;
}

/** Remember the card to charge for auto-recharge (and make it the customer's default). */
export async function storePaymentMethod(
  userId: string,
  paymentMethodId: string,
  customerId: string | null
): Promise<void> {
  await getDb()
    .insert(walletAccounts)
    .values({ userId, stripePaymentMethodId: paymentMethodId })
    .onConflictDoUpdate({
      target: walletAccounts.userId,
      set: { stripePaymentMethodId: paymentMethodId, updatedAt: new Date() },
    });
  if (customerId) {
    await getStripe()
      .customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })
      .catch((err) => console.warn("[wallet] default payment method not set:", err));
  }
}

function safeNotify(
  userId: string,
  event: Parameters<typeof notifyWalletState>[1],
  data?: Record<string, unknown>
): void {
  void notifyWalletState(userId, event, data).catch((err) => {
    console.warn(`[wallet] notify ${event} failed:`, err);
  });
}

// ---------------------------------------------------------------------------
// Checkout sessions
// ---------------------------------------------------------------------------

export type CheckoutReason = "amount" | "stripe";

export type TopupCheckoutResult =
  | { kind: "checkout"; url: string }
  | { kind: "error"; status: number; message: string; reason: CheckoutReason };

export interface CreateTopupCheckoutInput {
  userId: string;
  /** Session email, used when the users row has no deliverable address yet. */
  email: string | null;
  amountEur: number;
  /** Save the card for auto-recharge (setup_future_usage = off_session). */
  saveCard?: boolean;
  /** Public origin for the success / cancel URLs (lib/billing/origin.ts). */
  origin: string;
  /** Attribution to carry into the Stripe metadata (over the sign-up copy). */
  attribution?: Record<string, string> | null;
}

async function storedAttribution(userId: string): Promise<Record<string, unknown>> {
  try {
    const [row] = await getDb()
      .select({ metadata: users.metadata })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const a = (row?.metadata as Record<string, unknown> | undefined)?.attribution;
    return a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Open a Stripe Checkout (mode payment) that buys `amountEur` of paid credit. */
export async function createTopupCheckout(
  input: CreateTopupCheckoutInput
): Promise<TopupCheckoutResult> {
  const amount = parseTopupAmount(input.amountEur);
  if (!amount.ok) return { kind: "error", status: 400, message: amount.message, reason: "amount" };
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      kind: "error",
      status: 503,
      message: "Payments are not configured on this server.",
      reason: "stripe",
    };
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(input.userId, input.email);
    const origin = input.origin.replace(/\/$/, "");
    const taxCode = topupTaxCode();
    const core = {
      kind: TOPUP_KIND,
      userId: input.userId,
      amountMicros: String(amount.amountMicros),
    };
    const metadata: Record<string, string> = {
      ...core,
      amountEur: String(amount.amountEur),
      saveCard: input.saveCard ? "true" : "false",
      ...attributionMetadata({
        ...(await storedAttribution(input.userId)),
        ...(input.attribution ?? {}),
      }),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Top-ups are by card (terms §3.3): a saved card must be usable for
      // off-session auto-recharge, and a delayed method would credit late.
      payment_method_types: ["card"],
      customer,
      currency: "eur",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amount.amountCents,
            tax_behavior: topupTaxBehavior(),
            product_data: {
              name: "TwinMCP credit",
              description: `Prepaid TwinMCP usage credit (€${amount.amountEur})`,
              ...(taxCode ? { tax_code: taxCode } : {}),
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        description: "TwinMCP credit top-up",
        metadata: core,
        ...(input.saveCard ? { setup_future_usage: "off_session" as const } : {}),
      },
      // A receipt-grade invoice for every top-up (VAT/OSS evidence).
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: "TwinMCP prepaid credit",
          metadata: core,
        },
      },
      allow_promotion_codes: false,
      billing_address_collection: TAX_ENABLED ? "required" : "auto",
      ...(TAX_ENABLED
        ? {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            // Required with an existing customer: lets Checkout save the
            // address/name it collects, which Stripe Tax computes from.
            customer_update: { address: "auto" as const, name: "auto" as const },
          }
        : {}),
      ...topupReturnUrls(origin),
    });

    if (!session.url) {
      return {
        kind: "error",
        status: 500,
        message: "Stripe did not return a checkout URL",
        reason: "stripe",
      };
    }
    trackServer({
      event: "topup_checkout_started",
      distinctId: input.userId,
      properties: { amountEur: amount.amountEur, saveCard: !!input.saveCard },
    });
    return { kind: "checkout", url: session.url };
  } catch (err) {
    console.error("[wallet/topup]", err);
    Sentry.captureException(err, {
      tags: { area: "wallet", stage: "topup-checkout" },
      extra: { userId: input.userId, amountEur: amount.amountEur },
    });
    return {
      kind: "error",
      status: 500,
      message: "Could not start the payment. Please try again.",
      reason: "stripe",
    };
  }
}

/**
 * Open a setup-mode Checkout that saves a card for auto-recharge. With
 * `enableAutoRecharge`, the webhook switches auto-recharge on once the card is
 * saved (the settings themselves are stored before the redirect).
 */
export async function createCardSetupCheckout(input: {
  userId: string;
  email: string | null;
  origin: string;
  enableAutoRecharge: boolean;
}): Promise<TopupCheckoutResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      kind: "error",
      status: 503,
      message: "Payments are not configured on this server.",
      reason: "stripe",
    };
  }
  try {
    const customer = await getOrCreateCustomer(input.userId, input.email);
    const meta = { kind: CARD_SETUP_KIND, userId: input.userId };
    const session = await getStripe().checkout.sessions.create({
      mode: "setup",
      customer,
      payment_method_types: ["card"],
      metadata: { ...meta, enableAutoRecharge: input.enableAutoRecharge ? "true" : "false" },
      setup_intent_data: {
        description: "TwinMCP auto-recharge card",
        metadata: meta,
      },
      billing_address_collection: TAX_ENABLED ? "required" : "auto",
      ...cardSetupReturnUrls(input.origin),
    });
    if (!session.url) {
      return {
        kind: "error",
        status: 500,
        message: "Stripe did not return a checkout URL",
        reason: "stripe",
      };
    }
    return { kind: "checkout", url: session.url };
  } catch (err) {
    console.error("[wallet/card-setup]", err);
    Sentry.captureException(err, { tags: { area: "wallet", stage: "card-setup" } });
    return {
      kind: "error",
      status: 500,
      message: "Could not open the card form. Please try again.",
      reason: "stripe",
    };
  }
}

// ---------------------------------------------------------------------------
// Webhook handlers (called from app/api/webhooks/stripe/route.ts)
// Each one may throw on a DB error: the route then releases its event claim
// and Stripe retries; the ledger's idempotency keys make the retry safe.
// ---------------------------------------------------------------------------

/** checkout.session.completed / async_payment_succeeded for a paid wallet top-up. */
export async function applyTopupSession(
  session: Stripe.Checkout.Session,
  eventId: string
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[wallet] top-up session without userId", session.id);
    return;
  }
  const expectedMicros = Number(session.metadata?.amountMicros);
  const expectedCents =
    Number.isFinite(expectedMicros) && expectedMicros > 0
      ? Math.floor(expectedMicros / MICROS_PER_CENT)
      : 0;
  const cents = netCreditCents(session, expectedCents);
  if (cents <= 0) {
    console.error("[wallet] top-up session with nothing to credit", session.id);
    Sentry.captureMessage("wallet top-up with zero net amount", {
      tags: { area: "wallet", stage: "topup-credit" },
      extra: { sessionId: session.id },
    });
    return;
  }
  const paymentIntentId = stripeId(session.payment_intent);
  const customerId = stripeId(session.customer);
  const amountMicros = cents * MICROS_PER_CENT;
  const taxCents = Math.max(0, session.total_details?.amount_tax ?? 0);

  const res = await credit({
    userId,
    amountMicros,
    bucket: "paid",
    kind: "topup",
    idempotencyKey: `topup:${session.id}`,
    stripeRef: paymentIntentId ?? session.id,
    note: "Stripe Checkout top-up",
    units: {
      source: "checkout",
      sessionId: session.id,
      paymentIntentId,
      grossCents: session.amount_total ?? 0,
      taxCents,
      currency: session.currency ?? "eur",
    },
  });
  // markFunded is the only step after the credit that can throw. Its error is
  // held until the receipt, audit and revenue event of an APPLIED credit went
  // out: rethrowing first would make Stripe retry, the retry would find the
  // credit already applied (applied=false) and those side effects would never
  // happen. The retry still re-runs markFunded (idempotent).
  let firstFunding = false;
  let fundingError: unknown = null;
  try {
    firstFunding = await markFunded(userId);
  } catch (err) {
    fundingError = err;
  }

  if (customerId) {
    // Keep the customer → user link resolvable without a DB hit (legacy path).
    await getDb()
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(and(eq(users.id, userId), sql`${users.stripeCustomerId} IS NULL`))
      .catch((err) => console.warn("[wallet] customer id not stored:", err));
  }

  if (session.metadata?.saveCard === "true" && paymentIntentId) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
      const pm = stripeId(pi.payment_method);
      if (pm && pi.setup_future_usage === "off_session") {
        await storePaymentMethod(userId, pm, customerId);
        auditWallet({
          userId,
          action: "wallet.card_saved",
          targetId: pm,
          metadata: { source: "topup", stripeEvent: eventId },
        });
      }
    } catch (err) {
      // The credit is what matters; a missing saved card only means the user
      // re-enters it when enabling auto-recharge.
      console.warn("[wallet] could not save the top-up card:", err);
    }
  }

  if (!res.applied) {
    if (fundingError) throw fundingError;
    return;
  }

  const amountEur = cents / 100;
  auditWallet({
    userId,
    action: "wallet.topup",
    targetId: session.id,
    metadata: { amountMicros, taxCents, paymentIntentId, stripeEvent: eventId, firstFunding },
  });
  trackServer({
    event: "wallet_topup",
    distinctId: userId,
    properties: {
      amount: amountEur,
      currency: "eur",
      $revenue: amountEur,
      first: firstFunding,
      source: "checkout",
    },
  });
  if (firstFunding) {
    trackServer({
      event: "plan_upgraded",
      distinctId: userId,
      properties: { plan: "pro", previousPlan: "free", via: "wallet_topup" },
    });
  }
  safeNotify(userId, "topup_succeeded", {
    amountMicros,
    totalMicros: res.totalMicros,
    source: "checkout",
    stripeRef: session.id,
  });
  if (fundingError) throw fundingError;
}

/** checkout.session.completed in setup mode: store the card, maybe enable auto-recharge. */
export async function applyCardSetupSession(
  session: Stripe.Checkout.Session,
  eventId: string
): Promise<void> {
  const userId = session.metadata?.userId;
  const setupIntentId = stripeId(session.setup_intent);
  if (!userId || !setupIntentId) return;
  const si = await getStripe().setupIntents.retrieve(setupIntentId);
  const pm = stripeId(si.payment_method);
  if (!pm || si.status !== "succeeded") return;
  await storePaymentMethod(userId, pm, stripeId(session.customer));
  if (session.metadata?.enableAutoRecharge === "true") {
    await getDb()
      .update(walletAccounts)
      .set({ autoRechargeEnabled: true, updatedAt: new Date() })
      .where(eq(walletAccounts.userId, userId));
  }
  auditWallet({
    userId,
    action: "wallet.card_saved",
    targetId: pm,
    metadata: {
      source: "setup",
      autoRechargeEnabled: session.metadata?.enableAutoRecharge === "true",
      stripeEvent: eventId,
    },
  });
}

/**
 * Ledger rows of one payment intent (credits, clawbacks, dispute reversals),
 * whoever holds them: the owner comes from the credit row, not from the Stripe
 * customer mapping, so a drifted customer -> user link cannot skip a clawback.
 */
async function paymentLedger(
  paymentIntentId: string,
  exec: Pick<ReturnType<typeof getDb>, "select"> = getDb()
): Promise<(PaymentLedgerRow & { userId: string | null })[]> {
  const rows = await exec
    .select({
      userId: creditLedger.userId,
      kind: creditLedger.kind,
      deltaMicros: creditLedger.deltaMicros,
      units: creditLedger.units,
    })
    .from(creditLedger)
    .where(
      or(
        eq(creditLedger.stripeRef, paymentIntentId),
        sql`${creditLedger.units}->>'paymentIntentId' = ${paymentIntentId}`
      )
    );
  return rows.map((r) => ({
    userId: r.userId ?? null,
    kind: r.kind,
    deltaMicros: Number(r.deltaMicros),
    units: (r.units as Record<string, unknown> | null) ?? null,
  }));
}

/** The user whose top-up / auto-recharge credit this payment bought (null: none). */
function paymentOwner(
  rows: readonly (PaymentLedgerRow & { userId?: string | null })[]
): string | null {
  return (
    rows.find((r) => (r.kind === "topup" || r.kind === "auto_recharge") && r.userId)?.userId ?? null
  );
}

/** Thrown inside the clawback transaction when a concurrent clawback changed the amount. */
class ClawbackChanged extends Error {}

/**
 * Debit a clawback for one payment, serialized per payment intent: the amount
 * is computed from the ledger, then re-checked INSIDE the debit transaction
 * under pg_advisory_xact_lock(hashtext('clawback:'||pi)). If a concurrent
 * refund/dispute committed in between, the amount is recomputed, so two
 * partial refunds processed at once never claw back more than was refunded.
 */
async function clawbackDebit(
  paymentIntentId: string,
  computeAmount: (rows: PaymentLedgerRow[]) => number,
  build: (amount: number) => DebitInput
): Promise<{ res: DebitResult; amount: number } | null> {
  const lockKey = `clawback:${paymentIntentId}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const amount = computeAmount(await paymentLedger(paymentIntentId));
    if (amount <= 0) return null;
    try {
      const res = await debit(build(amount), {
        pre: async (tx: Tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
          if (computeAmount(await paymentLedger(paymentIntentId, tx)) !== amount) {
            throw new ClawbackChanged();
          }
        },
      });
      return { res, amount };
    } catch (err) {
      if (err instanceof ClawbackChanged && attempt < 3) continue;
      throw err;
    }
  }
  return null;
}

/** charge.refunded on a top-up / auto-recharge charge: claw the refunded share back. */
export async function applyChargeRefund(
  customerUserId: string,
  charge: Stripe.Charge,
  eventId: string
): Promise<void> {
  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) return;
  const rows = await paymentLedger(paymentIntentId);
  // Not a wallet payment (legacy invoice, …).
  if (summarizePaymentLedger(rows).creditedMicros <= 0) return;
  const userId = paymentOwner(rows) ?? customerUserId;
  const out = await clawbackDebit(
    paymentIntentId,
    (r) => {
      const summary = summarizePaymentLedger(r);
      return refundClawbackMicros({
        grossCents: summary.grossCents || charge.amount,
        refundedCents: charge.amount_refunded,
        creditedMicros: summary.creditedMicros,
        clawedByRefundMicros: summary.clawedByRefundMicros,
        clawedTotalMicros: summary.clawedTotalMicros,
      });
    },
    (amount) => ({
      userId,
      amountMicros: amount,
      kind: "clawback",
      bucket: "paid",
      // Cumulative refunded amount in the key: each new partial refund is a new
      // row, a redelivery of the same state is a no-op.
      idempotencyKey: `clawback:refund:${charge.id}:${charge.amount_refunded}`,
      stripeRef: paymentIntentId,
      note: "Refunded top-up",
      units: {
        source: "refund",
        chargeId: charge.id,
        paymentIntentId,
        refundedCents: charge.amount_refunded,
      },
    })
  );
  if (!out || !out.res.applied) return;
  const { res, amount } = out;
  // A clawback can empty the wallet: zero-balance email / auto-recharge as for usage.
  void afterBalanceChange(userId, { ...res, kind: "clawback" });
  auditWallet({
    userId,
    action: "wallet.clawback",
    targetId: charge.id,
    metadata: {
      reason: "refund",
      amountMicros: amount,
      refundedCents: charge.amount_refunded,
      paymentIntentId,
      totalMicros: res.totalMicros,
      stripeEvent: eventId,
    },
  });
}

/**
 * charge.dispute.created on a top-up charge: the money is held by the bank, so
 * the credit it bought is clawed back now, and auto-recharge is switched off
 * (no more off-session charges on a disputed card).
 */
export async function applyDisputeCreated(
  customerUserId: string,
  dispute: Stripe.Dispute,
  eventId: string
): Promise<void> {
  const paymentIntentId = stripeId(dispute.payment_intent);
  if (!paymentIntentId) return;
  const rows = await paymentLedger(paymentIntentId);
  const first = summarizePaymentLedger(rows);
  if (first.creditedMicros <= 0) return;
  const userId = paymentOwner(rows) ?? customerUserId;
  let grossCents = first.grossCents;
  if (!grossCents) {
    const chargeId = stripeId(dispute.charge);
    if (chargeId) grossCents = (await getStripe().charges.retrieve(chargeId)).amount;
  }

  await getDb()
    .update(walletAccounts)
    .set({ autoRechargeEnabled: false, updatedAt: new Date() })
    .where(eq(walletAccounts.userId, userId));

  const out = await clawbackDebit(
    paymentIntentId,
    (r) => {
      const summary = summarizePaymentLedger(r);
      return disputeClawbackMicros({
        grossCents,
        disputedCents: dispute.amount,
        creditedMicros: summary.creditedMicros,
        clawedTotalMicros: summary.clawedTotalMicros,
      });
    },
    (amount) => ({
      userId,
      amountMicros: amount,
      kind: "clawback",
      bucket: "paid",
      idempotencyKey: `clawback:dispute:${dispute.id}`,
      stripeRef: paymentIntentId,
      note: "Disputed top-up",
      units: {
        source: "dispute",
        disputeId: dispute.id,
        paymentIntentId,
        disputedCents: dispute.amount,
        reason: dispute.reason,
      },
    })
  );
  if (!out || !out.res.applied) return;
  const { res, amount } = out;
  // A clawback can empty the wallet: zero-balance email / auto-recharge as for usage.
  void afterBalanceChange(userId, { ...res, kind: "clawback" });
  auditWallet({
    userId,
    action: "wallet.clawback",
    targetId: dispute.id,
    metadata: {
      reason: "dispute",
      disputeReason: dispute.reason,
      amountMicros: amount,
      paymentIntentId,
      totalMicros: res.totalMicros,
      stripeEvent: eventId,
    },
  });
}

/** charge.dispute.closed: a dispute WON gives the clawed-back credit back. */
export async function applyDisputeClosed(
  userId: string,
  dispute: Stripe.Dispute,
  eventId: string
): Promise<void> {
  if (dispute.status !== "won") return;
  const [row] = await getDb()
    .select({ deltaMicros: creditLedger.deltaMicros })
    .from(creditLedger)
    .where(eq(creditLedger.idempotencyKey, `clawback:dispute:${dispute.id}`))
    .limit(1);
  const clawed = row ? -Number(row.deltaMicros) : 0;
  if (!(clawed > 0)) return;
  const paymentIntentId = stripeId(dispute.payment_intent);
  const res = await credit({
    userId,
    amountMicros: clawed,
    bucket: "paid",
    kind: "adjustment",
    idempotencyKey: `dispute_won:${dispute.id}`,
    ...(paymentIntentId ? { stripeRef: paymentIntentId } : {}),
    note: "Dispute won: credit restored",
    units: { source: "dispute_won", disputeId: dispute.id, paymentIntentId },
  });
  if (!res.applied) return;
  auditWallet({
    userId,
    action: "wallet.dispute_won",
    targetId: dispute.id,
    metadata: { amountMicros: clawed, totalMicros: res.totalMicros, stripeEvent: eventId },
  });
}
