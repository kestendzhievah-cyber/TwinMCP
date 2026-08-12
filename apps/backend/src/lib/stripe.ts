import Stripe from "stripe";

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
 * - `active` / `trialing` / `past_due` → restore the paid plan (from the
 *   subscription metadata, else the price id). `past_due` deliberately keeps
 *   the plan because Stripe is still retrying the card — this is what fixes the
 *   "customer pays but is stuck on free after a recovered payment" bug.
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
      metadataPlan === "pro" || metadataPlan === "team" ? metadataPlan : planFromPriceId(priceId);
    return plan ? { kind: "restore", plan } : { kind: "none" };
  }
  return { kind: "none" };
}

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? 0);

/**
 * Stripe Tax is opt-in. Automatic tax + tax-ID collection are only enabled when
 * the account is actually configured for it (registrations/nexus); forcing it
 * on for an unconfigured account breaks Checkout at the address/tax step. Kept
 * here so all Stripe config lives in one module.
 */
export const TAX_ENABLED = process.env.STRIPE_TAX_ENABLED === "true";
