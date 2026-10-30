// Subscriptions are retired (2026-10-29): TwinMCP is a prepaid wallet, and the
// only Checkout sessions it opens are top-ups and card setups, built in
// lib/wallet/topup.ts. The Pro subscription checkout (createProCheckout) is
// gone; POST /api/v2/billing/checkout answers 410 and its GET twin redirects
// to Billing.
//
// What remains here is a re-export of the pure helpers, for callers that still
// import them from this path.

export {
  CHECKOUT_FROMS,
  attributionMetadata,
  cardSetupReturnUrls,
  checkoutReturnUrls,
  isCheckoutErrorReason,
  isCheckoutFrom,
  topupReturnUrls,
} from "@/lib/billing/checkout-helpers";
export type { CheckoutErrorReason, CheckoutFrom } from "@/lib/billing/checkout-helpers";
