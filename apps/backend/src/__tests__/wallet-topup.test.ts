import { describe, it, expect, beforeEach, vi } from "vitest";

// lib/wallet/topup.ts (contract W3): amount validation, what a paid session
// credits, webhook routing, clawback math, and the idempotency of the credit
// path (a redelivered event never credits twice, never re-sends the email).

const mocks = vi.hoisted(() => ({
  credit: vi.fn(),
  debit: vi.fn(),
  notify: vi.fn(async () => {}),
  track: vi.fn(),
  sessionsCreate: vi.fn(),
  piRetrieve: vi.fn(),
  customersUpdate: vi.fn(async () => ({})),
  getOrCreateCustomer: vi.fn(async () => "cus_1"),
  dbUpdateSets: [] as unknown[],
  returning: [] as unknown[],
  ledgerRows: [] as unknown[],
  inserts: [] as unknown[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: mocks.track }));
vi.mock("@/lib/wallet/notify", () => ({ notifyWalletState: mocks.notify }));
vi.mock("@/lib/wallet/ledger", () => ({ credit: mocks.credit, debit: mocks.debit }));
vi.mock("@/lib/stripe", () => ({
  TAX_ENABLED: false,
  getOrCreateCustomer: mocks.getOrCreateCustomer,
  getStripe: () => ({
    checkout: { sessions: { create: mocks.sessionsCreate } },
    paymentIntents: { retrieve: mocks.piRetrieve },
    customers: { update: mocks.customersUpdate },
  }),
}));
vi.mock("@/db", () => {
  const thenable = <T>(value: T) => {
    const p = Promise.resolve(value) as Promise<T> & { returning: () => Promise<unknown[]> };
    p.returning = async () => mocks.returning;
    return p;
  };
  return {
    getDb: () => ({
      update: () => ({
        set: (values: unknown) => {
          mocks.dbUpdateSets.push(values);
          return { where: () => thenable([]) };
        },
      }),
      insert: () => ({
        values: (v: unknown) => {
          mocks.inserts.push(v);
          const p = Promise.resolve([] as unknown[]) as Promise<unknown[]> & {
            onConflictDoUpdate: () => Promise<unknown[]>;
          };
          p.onConflictDoUpdate = async () => [];
          return p;
        },
      }),
      select: () => ({
        from: () => ({
          where: () => {
            const p = Promise.resolve(mocks.ledgerRows) as Promise<unknown[]> & {
              limit: () => Promise<unknown[]>;
            };
            p.limit = async () => [];
            return p;
          },
        }),
      }),
    }),
  };
});

import {
  applyChargeRefund,
  applyTopupSession,
  createTopupCheckout,
  disputeClawbackMicros,
  netCreditCents,
  parseTopupAmount,
  refundClawbackMicros,
  stripeId,
  summarizePaymentLedger,
  topupTaxBehavior,
  topupTaxCode,
  walletPaymentIntentKind,
  walletSessionAction,
} from "@/lib/wallet/topup";
import { cardSetupReturnUrls, topupReturnUrls } from "@/lib/billing/checkout-helpers";
import type Stripe from "stripe";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dbUpdateSets.length = 0;
  mocks.inserts.length = 0;
  mocks.returning = [];
  mocks.ledgerRows = [];
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
});

describe("parseTopupAmount", () => {
  it("accepts the presets and any whole-euro custom amount in range", () => {
    for (const eur of [10, 25, 50, 100, 37, 1000]) {
      const r = parseTopupAmount(eur);
      expect(r).toEqual({
        ok: true,
        amountEur: eur,
        amountCents: eur * 100,
        amountMicros: eur * 1_000_000,
      });
    }
    expect(parseTopupAmount("25")).toMatchObject({ ok: true, amountEur: 25 });
    expect(parseTopupAmount(" 40 ")).toMatchObject({ ok: true, amountEur: 40 });
  });

  it("refuses below the minimum, above the maximum, fractions and junk", () => {
    expect(parseTopupAmount(9)).toMatchObject({ ok: false, message: "The minimum top-up is €10" });
    expect(parseTopupAmount(1001)).toMatchObject({
      ok: false,
      message: "The maximum top-up is €1000",
    });
    for (const bad of [
      10.5,
      "10.5",
      "1e3",
      "-20",
      -20,
      NaN,
      Infinity,
      null,
      undefined,
      {},
      "",
      "abc",
    ]) {
      expect(parseTopupAmount(bad).ok).toBe(false);
    }
  });

  it("honours custom limits", () => {
    expect(parseTopupAmount(5, { minTopupEur: 5, maxTopupEur: 10 }).ok).toBe(true);
    expect(parseTopupAmount(11, { minTopupEur: 5, maxTopupEur: 10 }).ok).toBe(false);
  });
});

describe("tax settings", () => {
  it("defaults to tax-exclusive prices", () => {
    expect(topupTaxBehavior({})).toBe("exclusive");
    expect(topupTaxBehavior({ WALLET_TOPUP_TAX_BEHAVIOR: "inclusive" })).toBe("inclusive");
    expect(topupTaxBehavior({ WALLET_TOPUP_TAX_BEHAVIOR: "weird" })).toBe("exclusive");
  });
  it("accepts only well-formed tax codes", () => {
    expect(topupTaxCode({ STRIPE_TOPUP_TAX_CODE: "txcd_10000000" })).toBe("txcd_10000000");
    expect(topupTaxCode({ STRIPE_TOPUP_TAX_CODE: "nope" })).toBeNull();
    expect(topupTaxCode({})).toBeNull();
  });
});

describe("netCreditCents", () => {
  it("credits the amount excluding tax", () => {
    // Exclusive: €25 + €5 VAT charged → €25 credited.
    expect(netCreditCents({ amount_total: 3000, total_details: { amount_tax: 500 } }, 2500)).toBe(
      2500
    );
    // Inclusive: €25 charged including €4.17 VAT → €20.83 credited.
    expect(netCreditCents({ amount_total: 2500, total_details: { amount_tax: 417 } }, 2500)).toBe(
      2083
    );
    // No tax.
    expect(netCreditCents({ amount_total: 1000, total_details: null }, 1000)).toBe(1000);
  });

  it("never credits more than the session was opened for, nor a negative amount", () => {
    expect(netCreditCents({ amount_total: 99_999, total_details: { amount_tax: 0 } }, 1000)).toBe(
      1000
    );
    expect(netCreditCents({ amount_total: 100, total_details: { amount_tax: 500 } }, 1000)).toBe(0);
    expect(netCreditCents({ amount_total: null }, 1000)).toBe(0);
  });
});

describe("walletSessionAction (webhook routing)", () => {
  const meta = (kind: string) => ({ kind, userId: "u1" });
  it("credits a paid top-up and waits for a pending one", () => {
    expect(
      walletSessionAction({
        mode: "payment",
        payment_status: "paid",
        metadata: meta("wallet_topup"),
      })
    ).toBe("credit");
    expect(
      walletSessionAction({
        mode: "payment",
        payment_status: "unpaid",
        metadata: meta("wallet_topup"),
      })
    ).toBe("await_payment");
    expect(
      walletSessionAction({
        mode: "payment",
        payment_status: "no_payment_required",
        metadata: meta("wallet_topup"),
      })
    ).toBe("ignore");
  });

  it("routes card setups, legacy subscriptions and foreign sessions", () => {
    expect(walletSessionAction({ mode: "setup", metadata: meta("wallet_card") })).toBe("save_card");
    expect(walletSessionAction({ mode: "setup", metadata: null })).toBe("ignore");
    expect(walletSessionAction({ mode: "subscription", metadata: { plan: "pro" } })).toBe("legacy");
    expect(
      walletSessionAction({ mode: "payment", payment_status: "paid", metadata: { kind: "other" } })
    ).toBe("ignore");
  });

  it("recognises auto-recharge PaymentIntents", () => {
    expect(walletPaymentIntentKind({ metadata: { kind: "auto_recharge" } })).toBe("auto_recharge");
    expect(walletPaymentIntentKind({ metadata: { kind: "wallet_topup" } })).toBe("wallet_topup");
    expect(walletPaymentIntentKind({ metadata: {} })).toBeNull();
    expect(walletPaymentIntentKind({})).toBeNull();
  });

  it("stripeId reads ids and expanded objects", () => {
    expect(stripeId("pi_1")).toBe("pi_1");
    expect(stripeId({ id: "pi_2" })).toBe("pi_2");
    expect(stripeId(null)).toBeNull();
  });
});

describe("clawback math", () => {
  const credited = 25_000_000; // €25 credited for a €30 gross charge (VAT on top)

  it("summarizes a payment's ledger rows", () => {
    const s = summarizePaymentLedger([
      { kind: "topup", deltaMicros: credited, units: { grossCents: 3000 } },
      { kind: "clawback", deltaMicros: -5_000_000, units: { source: "refund" } },
      { kind: "clawback", deltaMicros: -10_000_000, units: { source: "dispute" } },
      { kind: "adjustment", deltaMicros: 10_000_000, units: { source: "dispute_won" } },
    ]);
    expect(s).toEqual({
      creditedMicros: credited,
      grossCents: 3000,
      clawedByRefundMicros: 5_000_000,
      clawedTotalMicros: 5_000_000,
    });
  });

  it("claws back the refunded share of the credit, cumulatively", () => {
    // Full refund.
    expect(
      refundClawbackMicros({
        grossCents: 3000,
        refundedCents: 3000,
        creditedMicros: credited,
        clawedByRefundMicros: 0,
        clawedTotalMicros: 0,
      })
    ).toBe(credited);
    // Half refunded, then the rest: the second event takes only the difference.
    const first = refundClawbackMicros({
      grossCents: 3000,
      refundedCents: 1500,
      creditedMicros: credited,
      clawedByRefundMicros: 0,
      clawedTotalMicros: 0,
    });
    expect(first).toBe(12_500_000);
    expect(
      refundClawbackMicros({
        grossCents: 3000,
        refundedCents: 3000,
        creditedMicros: credited,
        clawedByRefundMicros: first,
        clawedTotalMicros: first,
      })
    ).toBe(credited - first);
  });

  it("never claws back more than what is left, nor on a redelivery", () => {
    expect(
      refundClawbackMicros({
        grossCents: 3000,
        refundedCents: 3000,
        creditedMicros: credited,
        clawedByRefundMicros: 0,
        clawedTotalMicros: credited, // a dispute already took it all
      })
    ).toBe(0);
    expect(
      refundClawbackMicros({
        grossCents: 3000,
        refundedCents: 1500,
        creditedMicros: credited,
        clawedByRefundMicros: 12_500_000,
        clawedTotalMicros: 12_500_000,
      })
    ).toBe(0);
    expect(
      refundClawbackMicros({
        grossCents: 0,
        refundedCents: 100,
        creditedMicros: credited,
        clawedByRefundMicros: 0,
        clawedTotalMicros: 0,
      })
    ).toBe(0);
  });

  it("claws back the disputed share", () => {
    expect(
      disputeClawbackMicros({
        grossCents: 3000,
        disputedCents: 3000,
        creditedMicros: credited,
        clawedTotalMicros: 0,
      })
    ).toBe(credited);
    expect(
      disputeClawbackMicros({
        grossCents: 3000,
        disputedCents: 3000,
        creditedMicros: credited,
        clawedTotalMicros: 20_000_000,
      })
    ).toBe(5_000_000);
  });
});

describe("return URLs", () => {
  it("top-up and card setup land on Billing with the session id", () => {
    expect(topupReturnUrls("https://twinmcp.fr/")).toEqual({
      success_url:
        "https://twinmcp.fr/dashboard/billing?topup=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://twinmcp.fr/dashboard/billing?topup=canceled",
    });
    expect(cardSetupReturnUrls("https://twinmcp.fr").success_url).toContain(
      "card=saved&session_id={CHECKOUT_SESSION_ID}"
    );
  });
});

describe("createTopupCheckout", () => {
  it("opens a one-off EUR payment for the credit, with receipts and no promo codes", async () => {
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/1" });
    const r = await createTopupCheckout({
      userId: "u1",
      email: "a@b.co",
      amountEur: 25,
      saveCard: true,
      origin: "https://twinmcp.fr",
    });
    expect(r).toEqual({ kind: "checkout", url: "https://checkout.stripe.com/c/1" });
    const params = mocks.sessionsCreate.mock.calls[0][0];
    expect(params.mode).toBe("payment");
    expect(params.customer).toBe("cus_1");
    expect(params.currency).toBe("eur");
    expect(params.line_items[0].price_data).toMatchObject({
      currency: "eur",
      unit_amount: 2500,
      product_data: { name: "TwinMCP credit" },
    });
    expect(params.metadata).toMatchObject({
      kind: "wallet_topup",
      userId: "u1",
      amountMicros: "25000000",
      saveCard: "true",
    });
    expect(params.payment_intent_data.setup_future_usage).toBe("off_session");
    expect(params.payment_intent_data.metadata.kind).toBe("wallet_topup");
    expect(params.invoice_creation.enabled).toBe(true);
    expect(params.allow_promotion_codes).toBe(false);
    expect(params.automatic_tax).toBeUndefined(); // STRIPE_TAX_ENABLED off in this test
    expect(params.success_url).toContain("topup=success");
  });

  it("does not save the card unless asked", async () => {
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/2" });
    await createTopupCheckout({ userId: "u1", email: null, amountEur: 10, origin: "https://x" });
    expect(mocks.sessionsCreate.mock.calls[0][0].payment_intent_data.setup_future_usage).toBe(
      undefined
    );
  });

  it("refuses an invalid amount before touching Stripe", async () => {
    const r = await createTopupCheckout({ userId: "u1", email: null, amountEur: 5, origin: "x" });
    expect(r).toMatchObject({ kind: "error", status: 400, reason: "amount" });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("reports a Stripe failure as a fixed reason", async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error("boom"));
    const r = await createTopupCheckout({ userId: "u1", email: null, amountEur: 10, origin: "x" });
    expect(r).toMatchObject({ kind: "error", status: 500, reason: "stripe" });
  });
});

function paidSession(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_1",
    mode: "payment",
    payment_status: "paid",
    amount_total: 3000,
    total_details: { amount_tax: 500, amount_discount: 0, amount_shipping: 0 },
    currency: "eur",
    customer: "cus_1",
    payment_intent: "pi_1",
    metadata: { kind: "wallet_topup", userId: "u1", amountMicros: "25000000", saveCard: "false" },
    ...over,
  } as unknown as Stripe.Checkout.Session;
}

describe("applyTopupSession (webhook credit)", () => {
  it("credits the paid bucket once, keyed on the session id, and marks the account funded", async () => {
    mocks.credit.mockResolvedValue({ applied: true, totalMicros: 25_000_000 });
    mocks.returning = [{ id: "u1" }]; // users.plan flipped free → pro
    await applyTopupSession(paidSession(), "evt_1");

    expect(mocks.credit).toHaveBeenCalledTimes(1);
    expect(mocks.credit.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      amountMicros: 25_000_000,
      bucket: "paid",
      kind: "topup",
      idempotencyKey: "topup:cs_test_1",
      stripeRef: "pi_1",
      units: { paymentIntentId: "pi_1", grossCents: 3000, taxCents: 500 },
    });
    expect(mocks.dbUpdateSets).toContainEqual(expect.objectContaining({ plan: "pro" }));
    expect(mocks.notify).toHaveBeenCalledWith(
      "u1",
      "topup_succeeded",
      expect.objectContaining({ amountMicros: 25_000_000 })
    );
    expect(mocks.track).toHaveBeenCalledWith(
      expect.objectContaining({ event: "plan_upgraded", distinctId: "u1" })
    );
  });

  it("a redelivered event (duplicate key) sends no second email or audit", async () => {
    mocks.credit.mockResolvedValue({ applied: false, totalMicros: 25_000_000 });
    await applyTopupSession(paidSession(), "evt_2");
    expect(mocks.credit).toHaveBeenCalledTimes(1);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0); // no audit row
  });

  it("a failed funding step still sends the receipt of an applied credit, then throws for a retry", async () => {
    mocks.credit.mockResolvedValue({ applied: true, totalMicros: 25_000_000 });
    mocks.dbUpdateSets.length = 0;
    const realPush = mocks.dbUpdateSets.push.bind(mocks.dbUpdateSets);
    let first = true;
    mocks.dbUpdateSets.push = (...v: unknown[]) => {
      if (first) {
        first = false;
        throw new Error("db down");
      }
      return realPush(...v);
    };
    try {
      await expect(applyTopupSession(paidSession(), "evt_5")).rejects.toThrow("db down");
    } finally {
      mocks.dbUpdateSets.push = realPush;
    }
    expect(mocks.notify).toHaveBeenCalledWith(
      "u1",
      "topup_succeeded",
      expect.objectContaining({ stripeRef: expect.any(String) })
    );
  });

  it("credits nothing for a session without a user or without money", async () => {
    await applyTopupSession(paidSession({ metadata: { kind: "wallet_topup" } }), "evt_3");
    await applyTopupSession(paidSession({ amount_total: 0 }), "evt_4");
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("saves the card only when the customer opted in", async () => {
    mocks.credit.mockResolvedValue({ applied: true, totalMicros: 1 });
    mocks.piRetrieve.mockResolvedValue({
      payment_method: "pm_1",
      setup_future_usage: "off_session",
    });
    await applyTopupSession(
      paidSession({
        metadata: {
          kind: "wallet_topup",
          userId: "u1",
          amountMicros: "25000000",
          saveCard: "true",
        },
      }),
      "evt_5"
    );
    expect(mocks.inserts).toContainEqual({ userId: "u1", stripePaymentMethodId: "pm_1" });
    expect(mocks.customersUpdate).toHaveBeenCalledWith("cus_1", {
      invoice_settings: { default_payment_method: "pm_1" },
    });
  });
});

describe("applyChargeRefund", () => {
  const charge = (amountRefunded: number) =>
    ({
      id: "ch_1",
      amount: 3000,
      amount_refunded: amountRefunded,
      payment_intent: "pi_1",
    }) as unknown as Stripe.Charge;

  it("debits the paid bucket for the refunded share, keyed on the cumulative refund", async () => {
    mocks.ledgerRows = [{ kind: "topup", deltaMicros: 25_000_000, units: { grossCents: 3000 } }];
    mocks.debit.mockResolvedValue({ applied: true, totalMicros: 12_500_000 });
    await applyChargeRefund("u1", charge(1500), "evt_r1");
    expect(mocks.debit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amountMicros: 12_500_000,
        kind: "clawback",
        bucket: "paid",
        idempotencyKey: "clawback:refund:ch_1:1500",
        stripeRef: "pi_1",
      }),
      // The amount is re-checked inside the debit transaction (advisory lock).
      expect.objectContaining({ pre: expect.any(Function) })
    );
  });

  it("charges the user who holds the credit row, not the Stripe customer's mapping", async () => {
    mocks.ledgerRows = [
      { userId: "u2", kind: "topup", deltaMicros: 25_000_000, units: { grossCents: 3000 } },
    ];
    mocks.debit.mockResolvedValue({ applied: true, totalMicros: 0 });
    await applyChargeRefund("u1", charge(3000), "evt_r3");
    expect(mocks.debit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2", amountMicros: 25_000_000 }),
      expect.anything()
    );
  });

  it("ignores refunds of charges that bought no credit", async () => {
    mocks.ledgerRows = [];
    await applyChargeRefund("u1", charge(3000), "evt_r2");
    expect(mocks.debit).not.toHaveBeenCalled();
  });
});
