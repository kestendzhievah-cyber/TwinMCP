import Stripe from "stripe";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

export type Cadence = "monthly" | "yearly";
export type BillablePlan = "pro" | "team";

interface PricePair {
  planName: string;
  monthly: string;
  yearly: string;
}

export const PRICES: Record<BillablePlan, PricePair> = {
  pro: {
    planName: "Pro",
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? "",
  },
  team: {
    planName: "Team",
    monthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ?? "",
    yearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID ?? "",
  },
};

export function getPriceId(plan: BillablePlan, cadence: Cadence): string {
  return PRICES[plan][cadence];
}

/**
 * Reverse of getPriceId: map a Stripe price ID back to our plan. Used to
 * recover the correct plan from a subscription (e.g. after dunning) when the
 * subscription metadata is missing. Returns null for unknown/unconfigured IDs.
 */
export function planFromPriceId(priceId: string | null | undefined): BillablePlan | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PRICES) as BillablePlan[]) {
    const pair = PRICES[plan];
    if (priceId === pair.monthly || priceId === pair.yearly) return plan;
  }
  return null;
}

export type SubscriptionPlanAction =
  | { kind: "downgrade" } // drop to free + stop over-quota runtimes
  | { kind: "restore"; plan: BillablePlan } // (re)apply the paid plan
  | { kind: "none" }; // leave the plan untouched, just update status fields

/**
 * Decide what to do to a user's plan from a Stripe subscription's status.
 * Extracted as a PURE function so the money path is unit-testable.
 *
 * - `unpaid` / `canceled` → downgrade to free (dunning exhausted / canceled).
 * - `active` / `trialing` / `past_due` → restore the paid plan. The price id is
 *   the source of truth (it's what the customer is actually billed), so it wins
 *   over the subscription metadata — which is set at checkout and goes STALE
 *   when the plan is switched via the Customer Portal. Metadata is only a
 *   fallback for when the price id isn't recognised. `past_due` deliberately
 *   keeps the plan because Stripe is still retrying the card — this is what
 *   fixes the "customer pays but is stuck on free after a recovered payment" bug.
 * - anything else (`incomplete`, `paused`, …) → leave the plan as-is.
 */
export function planActionForSubscription(opts: {
  status: string;
  metadataPlan?: string | null;
  priceId?: string | null;
}): SubscriptionPlanAction {
  const { status, metadataPlan, priceId } = opts;
  if (status === "unpaid" || status === "canceled") return { kind: "downgrade" };
  if (status === "active" || status === "trialing" || status === "past_due") {
    const plan =
      planFromPriceId(priceId) ??
      (metadataPlan === "pro" || metadataPlan === "team" ? metadataPlan : null);
    return plan ? { kind: "restore", plan } : { kind: "none" };
  }
  return { kind: "none" };
}

/**
 * Stripe Tax is opt-in. Automatic tax + tax-ID collection are only enabled when
 * the account is actually configured for it (registrations/nexus); forcing it
 * on for an unconfigured account breaks Checkout at the address/tax step. Kept
 * here so all Stripe config lives in one module.
 */
export const TAX_ENABLED = process.env.STRIPE_TAX_ENABLED === "true";

const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.twinmcp.fr";

function deliverable(email: string | null | undefined): string | null {
  return email && !email.endsWith(PLACEHOLDER_EMAIL_SUFFIX) ? email : null;
}

/**
 * The account's Stripe customer id, created on first use (a top-up, or saving
 * a card for auto-recharge). The id is persisted on users.stripe_customer_id
 * with a conditional UPDATE, so two concurrent first top-ups converge on one
 * customer: the loser re-reads the winner's id. The Stripe idempotency key
 * also collapses a double click into a single customer object.
 */
export async function getOrCreateCustomer(userId: string, email: string | null): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ stripeCustomerId: users.stripeCustomerId, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error("user not found");
  if (row.stripeCustomerId) return row.stripeCustomerId;

  const address = deliverable(row.email) ?? deliverable(email);
  const customer = await getStripe().customers.create(
    { ...(address ? { email: address } : {}), metadata: { userId } },
    { idempotencyKey: `twinmcp-customer:${userId}:${address ?? ""}` }
  );

  const claimed = await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)))
    .returning({ id: users.id });
  if (claimed.length > 0) return customer.id;

  // Lost the race to a concurrent request: use the id it stored.
  const [again] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return again?.stripeCustomerId ?? customer.id;
}

/** /api/health state of the Stripe account itself (no price id involved). */
export type StripeAccountHealth = "configured" | "unconfigured" | "invalid" | "unreachable";

/**
 * Price-independent billing probe for /api/health: top-ups use inline
 * price_data, so the only hard requirement is a working secret key. Bounded by
 * `timeoutMs`, never throws, never returns a secret.
 */
export async function probeStripeAccount(timeoutMs = 1500): Promise<StripeAccountHealth> {
  if (!process.env.STRIPE_SECRET_KEY) return "unconfigured";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getStripe().balance.retrieve(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return "configured";
  } catch (err) {
    const type = (err as { type?: unknown })?.type;
    if (type === "StripeAuthenticationError" || type === "StripePermissionError") return "invalid";
    return "unreachable";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---- Pure helpers for the webhook and the health probe ----------------------
// Kept free of I/O so the money path stays unit-testable (__tests__/stripe.test.ts).

/** Which cadence a configured price id bills at, or null when it is not one of ours. */
export function cadenceFromPriceId(priceId: string | null | undefined): Cadence | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PRICES) as BillablePlan[]) {
    const pair = PRICES[plan];
    if (pair.monthly && priceId === pair.monthly) return "monthly";
    if (pair.yearly && priceId === pair.yearly) return "yearly";
  }
  return null;
}

/** A Stripe recurring interval → our cadence ("year" → yearly, anything else → monthly). */
export function cadenceFromInterval(interval: string | null | undefined): Cadence | null {
  if (interval === "year") return "yearly";
  if (interval === "month") return "monthly";
  return null;
}

/**
 * The subscription id an invoice belongs to. API 2026-03 dahlia moved it from
 * invoice.subscription to invoice.parent.subscription_details.subscription;
 * both shapes are read so a future move does not silently null it.
 */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== "object") return null;
  const inv = invoice as {
    parent?: { subscription_details?: { subscription?: unknown } | null } | null;
    subscription?: unknown;
  };
  const raw = inv.parent?.subscription_details?.subscription ?? inv.subscription;
  if (typeof raw === "string") return raw || null;
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

/** The first line's price id (lines[].pricing.price_details.price, or the legacy lines[].price). */
export function invoicePriceId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== "object") return null;
  const lines = (invoice as { lines?: { data?: unknown[] } }).lines?.data;
  if (!Array.isArray(lines)) return null;
  for (const line of lines) {
    if (!line || typeof line !== "object") continue;
    const l = line as {
      pricing?: { price_details?: { price?: unknown } | null } | null;
      price?: unknown;
    };
    const raw = l.pricing?.price_details?.price ?? l.price;
    if (typeof raw === "string" && raw) return raw;
    if (raw && typeof raw === "object" && "id" in raw) {
      const id = (raw as { id?: unknown }).id;
      if (typeof id === "string" && id) return id;
    }
  }
  return null;
}

/**
 * Is this paid invoice the first charge after a free trial (trial → paid)?
 *
 * Stripe does not order webhooks, so two signals are accepted:
 *  - the account was still mirrored as `trialing` when the invoice landed, or
 *  - the invoice is a regular renewal (`subscription_cycle`) of a subscription
 *    known to have started on a trial (users.metadata.billing.trialStartedAt,
 *    or a trial that ended right before the invoice) — this covers the case
 *    where customer.subscription.updated (trialing → active) arrived first.
 * A conversion is counted once per account (`alreadyConverted`), and never for
 * a zero-amount invoice (the €0 invoice that opens a trial).
 */
export function isTrialConversion(opts: {
  amountPaid: number;
  billingReason: string | null | undefined;
  storedStatus: string | null | undefined;
  trialStarted: boolean;
  alreadyConverted: boolean;
}): boolean {
  if (opts.alreadyConverted || !(opts.amountPaid > 0)) return false;
  if (opts.storedStatus === "trialing") return true;
  return opts.billingReason === "subscription_cycle" && opts.trialStarted;
}

/**
 * Did this customer.subscription.updated schedule a cancellation? True when
 * cancel_at_period_end flipped false → true, or cancel_at went from unset to a
 * date (the Customer Portal can use either, depending on its configuration).
 */
export function cancellationScheduled(
  previous: { cancel_at_period_end?: boolean | null; cancel_at?: number | null } | null | undefined,
  current: { cancel_at_period_end?: boolean | null; cancel_at?: number | null }
): boolean {
  if (!previous) return false;
  if (
    "cancel_at_period_end" in previous &&
    previous.cancel_at_period_end === false &&
    current.cancel_at_period_end === true
  ) {
    return true;
  }
  return (
    "cancel_at" in previous &&
    (previous.cancel_at === null || previous.cancel_at === undefined) &&
    typeof current.cancel_at === "number"
  );
}

/**
 * The one-word reason we report for a cancellation: the customer's portal
 * feedback when they gave one ("too_expensive", "unused", …), else Stripe's
 * cancellation reason ("cancellation_requested", "payment_failed", …), else
 * the fallback.
 */
export function cancellationReason(
  details: { feedback?: string | null; reason?: string | null } | null | undefined,
  fallback: string
): string {
  return details?.feedback || details?.reason || fallback;
}

/** /api/health billing state of one configured price id. */
export type PriceHealth = "configured" | "missing" | "invalid" | "unreachable" | "unconfigured";

/**
 * Classify a retrieved Stripe price against the cadence it is configured for.
 * Invalid = archived, not recurring, or billed at the wrong interval (the
 * yearly env var pointing at a monthly price is the classic mix-up).
 */
export function classifyPrice(
  price: { active?: boolean; recurring?: { interval?: string | null } | null } | null | undefined,
  cadence: Cadence
): "configured" | "invalid" {
  if (!price || price.active === false) return "invalid";
  const interval = price.recurring?.interval;
  if (!interval) return "invalid";
  return cadenceFromInterval(interval) === cadence ? "configured" : "invalid";
}

/**
 * @deprecated Subscriptions are retired; use probeStripeAccount. Kept for the
 * legacy /api/health fields until that route stops reporting price ids.
 *
 * Probe one configured price (bounded by `timeoutMs`, never throws, never
 * returns the id or any secret). "invalid" only for an answer from Stripe
 * (unknown id, wrong mode, archived, wrong interval); a timeout or network
 * error is "unreachable" so a Stripe blip is not reported as a config error.
 */
export async function probePrice(cadence: Cadence, timeoutMs = 1500): Promise<PriceHealth> {
  if (!process.env.STRIPE_SECRET_KEY) return "unconfigured";
  const id = getPriceId("pro", cadence);
  if (!id) return "missing";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const price = await Promise.race([
      getStripe().prices.retrieve(id),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return classifyPrice(price, cadence);
  } catch (err) {
    const type = (err as { type?: unknown })?.type;
    // StripeInvalidRequestError = "No such price" (unknown id, or a test-mode id
    // with a live key). StripeAuthenticationError / StripePermissionError mean
    // the key itself is wrong: checkout fails just the same.
    if (
      type === "StripeInvalidRequestError" ||
      type === "StripeAuthenticationError" ||
      type === "StripePermissionError"
    ) {
      return "invalid";
    }
    return "unreachable";
  } finally {
    if (timer) clearTimeout(timer);
  }
}
