import { describe, expect, it } from "vitest";
import {
  conversionFromCheckoutSession,
  isCheckoutSessionId,
  type CheckoutSessionLike,
} from "../lib/billing/checkout-conversion";

// The Google Ads "Abonnement" conversion is computed from the Stripe session the
// success URL points at. It must only count the signed-in user's completed
// checkout, and report the real amount.
const base: CheckoutSessionLike = {
  id: "cs_test_abc123",
  status: "complete",
  payment_status: "paid",
  amount_total: 1499,
  currency: "eur",
  metadata: { userId: "user-1", plan: "pro" },
  line_items: { data: [{ price: { unit_amount: 1499 } }] },
};

describe("conversionFromCheckoutSession", () => {
  it("reports the amount actually paid, in major units and upper-case currency", () => {
    expect(conversionFromCheckoutSession(base, "user-1")).toEqual({
      transactionId: "cs_test_abc123",
      value: 14.99,
      currency: "EUR",
    });
  });

  it("ignores a session that belongs to another user", () => {
    expect(conversionFromCheckoutSession(base, "user-2")).toBeNull();
  });

  it("ignores a session that is not complete or not paid", () => {
    expect(conversionFromCheckoutSession({ ...base, status: "open" }, "user-1")).toBeNull();
    expect(
      conversionFromCheckoutSession({ ...base, payment_status: "unpaid" }, "user-1")
    ).toBeNull();
  });

  it("uses the first-period price for a free trial (nothing charged yet)", () => {
    const trial = { ...base, amount_total: 0, payment_status: "no_payment_required" };
    expect(conversionFromCheckoutSession(trial, "user-1")?.value).toBe(14.99);
  });

  it("falls back to zero and EUR when Stripe omits amounts and currency", () => {
    const bare = { ...base, amount_total: null, currency: null, line_items: null };
    expect(conversionFromCheckoutSession(bare, "user-1")).toEqual({
      transactionId: "cs_test_abc123",
      value: 0,
      currency: "EUR",
    });
  });
});

describe("isCheckoutSessionId", () => {
  it("accepts Stripe checkout session ids only", () => {
    expect(isCheckoutSessionId("cs_live_a1B2c3")).toBe(true);
    expect(isCheckoutSessionId("cs_test_a1B2c3")).toBe(true);
    expect(isCheckoutSessionId("{CHECKOUT_SESSION_ID}")).toBe(false);
    expect(isCheckoutSessionId("pi_123")).toBe(false);
    expect(isCheckoutSessionId(undefined)).toBe(false);
  });
});
