// Turns a completed Stripe Checkout session into the payload of the Google Ads
// purchase conversion fired on /dashboard/billing?topup=success (a wallet
// top-up; legacy subscription sessions too).
//
// The session id comes from the URL, so it is verified against Stripe: it must
// be complete and belong to the signed-in user. The value is what the customer
// paid EXCLUDING VAT (amount_total minus total_details.amount_tax): VAT
// is not revenue. For a legacy free trial (nothing charged) it is the plan's
// first period price.

import { getStripe } from "@/lib/stripe";

export interface AdsConversion {
  /** Stripe Checkout session id, sent as transaction_id so Google dedupes reloads. */
  transactionId: string;
  value: number;
  currency: string;
}

/** The subset of a Stripe Checkout session this module reads. */
export interface CheckoutSessionLike {
  id: string;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  total_details?: { amount_tax?: number | null } | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  line_items?: { data: Array<{ price: { unit_amount: number | null } | null }> } | null;
}

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export function isCheckoutSessionId(id: string | undefined | null): id is string {
  return typeof id === "string" && SESSION_ID.test(id);
}

/** Pure mapping, unit-tested: null when the session must not count. */
export function conversionFromCheckoutSession(
  session: CheckoutSessionLike,
  userId: string
): AdsConversion | null {
  if (session.metadata?.userId !== userId) return null;
  if (session.status !== "complete") return null;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return null;
  }
  const tax = Math.max(0, session.total_details?.amount_tax ?? 0);
  // Inclusive or exclusive tax alike, the total minus its tax is the net paid.
  const charged = Math.max(0, (session.amount_total ?? 0) - tax);
  const firstPeriod = session.line_items?.data[0]?.price?.unit_amount ?? 0;
  const cents = charged > 0 ? charged : firstPeriod;
  return {
    transactionId: session.id,
    value: Math.round(cents) / 100,
    currency: (session.currency ?? "eur").toUpperCase(),
  };
}

/** Fetches the session from Stripe. Never throws: a lookup failure only skips the conversion. */
export async function getCheckoutConversion(
  sessionId: string,
  userId: string
): Promise<AdsConversion | null> {
  if (!isCheckoutSessionId(sessionId)) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });
    return conversionFromCheckoutSession(session as unknown as CheckoutSessionLike, userId);
  } catch (err) {
    console.error("[billing/checkout-conversion]", err);
    return null;
  }
}
