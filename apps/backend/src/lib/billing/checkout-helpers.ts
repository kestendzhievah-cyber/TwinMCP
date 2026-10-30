// Pure, client-safe checkout helpers (wallet top-ups, card setup, the retired
// subscription return URLs still read by the billing page): no database, Stripe
// or Sentry imports, so they can be unit-tested directly and imported by the
// webhook and auth code without pulling the Stripe client.

import { ATTRIBUTION_KEYS } from "@/lib/analytics/attribution";

/** Where the checkout was started. Decides where Stripe sends the user back. */
export type CheckoutFrom = "billing" | "onboarding" | "pricing" | "signup";

export const CHECKOUT_FROMS: readonly CheckoutFrom[] = [
  "billing",
  "onboarding",
  "pricing",
  "signup",
];

export function isCheckoutFrom(value: string | null | undefined): value is CheckoutFrom {
  return typeof value === "string" && (CHECKOUT_FROMS as readonly string[]).includes(value);
}

/**
 * Why a checkout could not be opened, as a fixed code: the billing page maps it
 * to its own copy, so no server-provided text ever reaches the UI through a
 * query string.
 */
export type CheckoutErrorReason = "price" | "stripe" | "unknown";

export function isCheckoutErrorReason(
  value: string | null | undefined
): value is CheckoutErrorReason {
  return value === "price" || value === "stripe" || value === "unknown";
}

// Stripe metadata: string values of at most 500 characters. Only the shared
// attribution keys (lib/analytics/attribution.ts) plus the context fields the
// sign-up form records with them.
const ATTRIBUTION_METADATA_KEYS: readonly string[] = [
  ...ATTRIBUTION_KEYS,
  "landing_path",
  "locale",
  "referrer_host",
  "first_seen_at",
];

/** Attribution → Stripe-safe metadata (known keys, non-empty strings, ≤ 500 chars). */
export function attributionMetadata(
  attribution: Record<string, unknown> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attribution || typeof attribution !== "object") return out;
  for (const key of ATTRIBUTION_METADATA_KEYS) {
    const value = attribution[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = trimmed.slice(0, 500);
  }
  return out;
}

/** Where Stripe sends the user after checkout, by surface (contract C3). */
export function checkoutReturnUrls(origin: string, from: CheckoutFrom) {
  const base = origin.replace(/\/$/, "");
  // Both carry the session id so the Google Ads "Abonnement" conversion can
  // verify the session server-side wherever the user lands.
  if (from === "onboarding" || from === "signup") {
    return {
      success_url: `${base}/onboarding?status=success&step=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/onboarding?checkout=canceled`,
    };
  }
  return {
    success_url: `${base}/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/dashboard/billing?status=canceled`,
  };
}

/**
 * Where Stripe sends the user after a wallet top-up (lib/wallet/topup.ts).
 * The success URL carries the session id so the billing page can verify the
 * payment (and fire the ads conversion) server-side.
 */
export function topupReturnUrls(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    success_url: `${base}/dashboard/billing?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/dashboard/billing?topup=canceled`,
  };
}

/** Where Stripe sends the user after saving a card for auto-recharge (setup mode). */
export function cardSetupReturnUrls(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    success_url: `${base}/dashboard/billing?card=saved&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/dashboard/billing?card=canceled`,
  };
}
