import { describe, it, expect, beforeEach, vi } from "vitest";

// lib/wallet/auto-recharge.ts (contract W3): settings rules, the recharge
// decision (threshold, monthly cap, saved card), the Stripe idempotency key,
// and the idempotent settlement of a succeeded PaymentIntent.

const mocks = vi.hoisted(() => ({
  credit: vi.fn(),
  notify: vi.fn(async () => {}),
  taxTx: vi.fn(async () => ({})),
  returning: [] as unknown[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/wallet/notify", () => ({ notifyWalletState: mocks.notify }));
vi.mock("@/lib/wallet/ledger", () => ({
  credit: mocks.credit,
  debit: vi.fn(),
  getWallet: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  TAX_ENABLED: false,
  getOrCreateCustomer: vi.fn(),
  getStripe: () => ({ tax: { transactions: { createFromCalculation: mocks.taxTx } } }),
}));
vi.mock("@/db", () => ({
  getDb: () => ({
    update: () => ({
      set: () => ({
        where: () => {
          const p = Promise.resolve([] as unknown[]) as Promise<unknown[]> & {
            returning: () => Promise<unknown[]>;
          };
          p.returning = async () => mocks.returning;
          return p;
        },
      }),
    }),
    insert: () => ({ values: () => Promise.resolve([]) }),
  }),
}));

import {
  applyAutoRechargePatch,
  autoRechargeIdempotencyKey,
  isCardFailure,
  monthStartUtc,
  PENDING_KEY,
  pendingAutoRecharge,
  planAutoRecharge,
  settleAutoRecharge,
  type AutoRechargeSettings,
} from "@/lib/wallet/auto-recharge";
import type Stripe from "stripe";

const E = 1_000_000;
const DEFAULTS: AutoRechargeSettings = {
  enabled: false,
  thresholdMicros: 5 * E,
  amountMicros: 20 * E,
  monthlyCapMicros: 100 * E,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.returning = [];
});

describe("applyAutoRechargePatch", () => {
  it("accepts valid settings and converts euros to micros", () => {
    expect(
      applyAutoRechargePatch(DEFAULTS, {
        enabled: true,
        thresholdEur: 2.5,
        amountEur: 10,
        monthlyCapEur: 10,
      })
    ).toEqual({
      ok: true,
      next: {
        enabled: true,
        thresholdMicros: 2_500_000,
        amountMicros: 10 * E,
        monthlyCapMicros: 10 * E,
      },
    });
  });

  it("enforces threshold ≥ €2, amount ≥ €10 (whole euros), cap ≥ amount", () => {
    expect(applyAutoRechargePatch(DEFAULTS, { thresholdEur: 1.99 }).ok).toBe(false);
    expect(applyAutoRechargePatch(DEFAULTS, { thresholdEur: 2.001 }).ok).toBe(false);
    expect(applyAutoRechargePatch(DEFAULTS, { amountEur: 9 }).ok).toBe(false);
    expect(applyAutoRechargePatch(DEFAULTS, { amountEur: 10.5 }).ok).toBe(false);
    expect(applyAutoRechargePatch(DEFAULTS, { amountEur: 1001 }).ok).toBe(false);
    expect(applyAutoRechargePatch(DEFAULTS, { monthlyCapEur: 0 }).ok).toBe(false);
    expect(applyAutoRechargePatch(DEFAULTS, { monthlyCapEur: 5001 }).ok).toBe(false);
    // The cap is checked against the MERGED amount (current €20).
    expect(applyAutoRechargePatch(DEFAULTS, { monthlyCapEur: 15 })).toEqual({
      ok: false,
      message: "The monthly cap must be at least the recharge amount",
    });
    expect(applyAutoRechargePatch(DEFAULTS, { amountEur: 200 }).ok).toBe(false); // cap €100
    expect(applyAutoRechargePatch(DEFAULTS, { amountEur: 200, monthlyCapEur: 400 }).ok).toBe(true);
  });

  it("an empty patch keeps the current settings", () => {
    expect(applyAutoRechargePatch(DEFAULTS, {})).toEqual({ ok: true, next: DEFAULTS });
  });
});

describe("planAutoRecharge", () => {
  const base = {
    enabled: true,
    hasCard: true,
    totalMicros: 4 * E,
    thresholdMicros: 5 * E,
    amountMicros: 20 * E,
    monthlyCapMicros: 100 * E,
    monthRechargedMicros: 0,
    minMicros: 10 * E,
  };

  it("recharges the configured amount below the threshold", () => {
    expect(planAutoRecharge(base)).toEqual({ charge: true, amountMicros: 20 * E });
    expect(planAutoRecharge({ ...base, totalMicros: -1 * E })).toEqual({
      charge: true,
      amountMicros: 20 * E,
    });
  });

  it("does nothing when off, without a card, or at/above the threshold", () => {
    expect(planAutoRecharge({ ...base, enabled: false })).toEqual({
      charge: false,
      reason: "disabled",
    });
    expect(planAutoRecharge({ ...base, hasCard: false })).toEqual({
      charge: false,
      reason: "no_card",
    });
    expect(planAutoRecharge({ ...base, totalMicros: 5 * E })).toEqual({
      charge: false,
      reason: "above_threshold",
    });
  });

  it("trims to the monthly cap, and stops below the minimum top-up", () => {
    expect(planAutoRecharge({ ...base, monthRechargedMicros: 85 * E })).toEqual({
      charge: true,
      amountMicros: 15 * E,
    });
    expect(planAutoRecharge({ ...base, monthRechargedMicros: 95 * E })).toEqual({
      charge: false,
      reason: "monthly_cap",
    });
    expect(planAutoRecharge({ ...base, monthRechargedMicros: 100 * E })).toEqual({
      charge: false,
      reason: "monthly_cap",
    });
  });

  it("charges whole cents only", () => {
    expect(planAutoRecharge({ ...base, monthRechargedMicros: 79_995_001 })).toEqual({
      charge: true,
      amountMicros: 20 * E,
    });
    expect(
      planAutoRecharge({ ...base, monthlyCapMicros: 100 * E, monthRechargedMicros: 84_999_999 })
    ).toEqual({ charge: true, amountMicros: 15 * E });
    expect(
      planAutoRecharge({ ...base, monthlyCapMicros: 100 * E, monthRechargedMicros: 85_005_000 })
    ).toEqual({ charge: true, amountMicros: 14_990_000 });
  });
});

describe("month and idempotency key", () => {
  it("monthStartUtc is the first instant of the UTC month", () => {
    expect(monthStartUtc(new Date("2026-10-29T23:59:00Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z"
    );
    expect(monthStartUtc(new Date("2026-01-01T00:00:00Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });

  it("racing triggers share a key; the next recharge or window gets a new one", () => {
    const t = new Date("2026-10-29T10:01:00Z");
    const a = autoRechargeIdempotencyKey("u1", t, 2);
    expect(a).toBe(autoRechargeIdempotencyKey("u1", new Date("2026-10-29T10:05:00Z"), 2));
    expect(a).not.toBe(autoRechargeIdempotencyKey("u1", t, 3));
    expect(a).not.toBe(autoRechargeIdempotencyKey("u1", new Date("2026-10-29T10:11:00Z"), 2));
    expect(a).not.toBe(autoRechargeIdempotencyKey("u2", t, 2));
    expect(a.startsWith("twinmcp-ar:u1:2026-10:2:")).toBe(true);
  });

  it("isCardFailure tells a refused card from an outage", () => {
    expect(isCardFailure({ type: "StripeCardError", code: "card_declined" })).toBe(true);
    expect(
      isCardFailure({ type: "StripeInvalidRequestError", code: "authentication_required" })
    ).toBe(true);
    expect(isCardFailure({ type: "StripeConnectionError" })).toBe(false);
    expect(isCardFailure(new Error("timeout"))).toBe(false);
    expect(isCardFailure(null)).toBe(false);
  });
});

function pi(over: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: "pi_ar_1",
    status: "succeeded",
    amount: 2400,
    amount_received: 2400,
    currency: "eur",
    metadata: { kind: "auto_recharge", userId: "u1", amountMicros: "20000000", taxCents: "400" },
    ...over,
  } as unknown as Stripe.PaymentIntent;
}

describe("settleAutoRecharge", () => {
  it("credits the paid bucket, keyed on the PaymentIntent id", async () => {
    mocks.credit.mockResolvedValue({ applied: true, totalMicros: 24 * E });
    await settleAutoRecharge(pi());
    expect(mocks.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amountMicros: 20 * E,
        bucket: "paid",
        kind: "auto_recharge",
        idempotencyKey: "autorecharge:pi_ar_1",
        stripeRef: "pi_ar_1",
      })
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      "u1",
      "topup_succeeded",
      expect.objectContaining({ source: "auto_recharge" })
    );
  });

  it("the webhook after the synchronous path is a no-op (no second email)", async () => {
    mocks.credit.mockResolvedValue({ applied: false, totalMicros: 24 * E });
    await settleAutoRecharge(pi());
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("records the Stripe Tax transaction when a calculation was used", async () => {
    mocks.credit.mockResolvedValue({ applied: true, totalMicros: 1 });
    await settleAutoRecharge(
      pi({
        metadata: {
          kind: "auto_recharge",
          userId: "u1",
          amountMicros: "20000000",
          taxCalculation: "taxcalc_1",
        },
      })
    );
    expect(mocks.taxTx).toHaveBeenCalledWith({ calculation: "taxcalc_1", reference: "pi_ar_1" });
  });

  it("ignores unsucceeded, foreign or malformed PaymentIntents", async () => {
    await settleAutoRecharge(pi({ status: "processing" }));
    await settleAutoRecharge(pi({ metadata: { kind: "wallet_topup", userId: "u1" } }));
    await settleAutoRecharge(
      pi({ metadata: { kind: "auto_recharge", userId: "u1", amountMicros: "abc" } })
    );
    expect(mocks.credit).not.toHaveBeenCalled();
  });
});

describe("pendingAutoRecharge", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  it("a recharge still settling blocks a new one", () => {
    expect(pendingAutoRecharge({ [PENDING_KEY]: { at: "2026-11-10T11:50:00.000Z" } }, now)).toBe(
      true
    );
  });
  it("no marker, a malformed one, or a stale one (lost webhook) does not block", () => {
    expect(pendingAutoRecharge({}, now)).toBe(false);
    expect(pendingAutoRecharge(null, now)).toBe(false);
    expect(pendingAutoRecharge({ [PENDING_KEY]: { at: 42 } }, now)).toBe(false);
    expect(pendingAutoRecharge({ [PENDING_KEY]: { at: "2026-11-01T00:00:00.000Z" } }, now)).toBe(
      false
    );
  });
});
