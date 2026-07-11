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

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? 0);
