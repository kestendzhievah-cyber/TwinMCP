import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

export const PRICES: Record<string, { planName: string; priceId: string }> = {
  pro: {
    planName: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
  },
  team: {
    planName: "Team",
    priceId: process.env.STRIPE_PRICE_TEAM ?? "",
  },
};
