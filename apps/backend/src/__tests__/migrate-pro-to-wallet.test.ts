import { describe, it, expect } from "vitest";
import {
  invoiceAmountExTaxCents,
  invoiceServicePeriod,
  lastPaidInvoice,
  planConversion,
  shouldMarkFunded,
  proratedUnusedCents,
  type InvoiceLike,
} from "../../scripts/migrate-pro-to-wallet";

// scripts/migrate-pro-to-wallet.ts: the subscription → credit conversion math.
// Pure helpers only (the runner is not executed on import).

const DAY = 86_400;
const START = 1_790_000_000; // a period start, unix seconds
const MONTH_END = START + 30 * DAY;

function invoice(over: Partial<InvoiceLike> = {}): InvoiceLike {
  return {
    id: "in_1",
    status: "paid",
    created: START,
    amount_paid: 1799, // €14.99 + 20% VAT
    total_excluding_tax: 1499,
    lines: { data: [{ amount: 1499, period: { start: START, end: MONTH_END } }] },
    ...over,
  };
}

describe("proratedUnusedCents", () => {
  it("credits the unused share of the period, floored", () => {
    expect(
      proratedUnusedCents({
        amountExTaxCents: 1499,
        periodStart: START,
        periodEnd: MONTH_END,
        now: START + 10 * DAY,
      })
    ).toBe(999); // 1499 × 20/30 = 999.33
    expect(
      proratedUnusedCents({
        amountExTaxCents: 1499,
        periodStart: START,
        periodEnd: MONTH_END,
        now: START,
      })
    ).toBe(1499);
  });

  it("is 0 once the period is over, and clamps a future 'now'", () => {
    expect(
      proratedUnusedCents({
        amountExTaxCents: 1499,
        periodStart: START,
        periodEnd: MONTH_END,
        now: MONTH_END + 1,
      })
    ).toBe(0);
    expect(
      proratedUnusedCents({
        amountExTaxCents: 1499,
        periodStart: START,
        periodEnd: MONTH_END,
        now: START - DAY,
      })
    ).toBe(1499);
  });

  it("is 0 for a zero amount or an empty period", () => {
    expect(
      proratedUnusedCents({
        amountExTaxCents: 0,
        periodStart: START,
        periodEnd: MONTH_END,
        now: START,
      })
    ).toBe(0);
    expect(
      proratedUnusedCents({
        amountExTaxCents: 1499,
        periodStart: START,
        periodEnd: START,
        now: START,
      })
    ).toBe(0);
  });

  it("handles a yearly period", () => {
    const yearEnd = START + 365 * DAY;
    expect(
      proratedUnusedCents({
        amountExTaxCents: 14_900,
        periodStart: START,
        periodEnd: yearEnd,
        now: START + 73 * DAY,
      })
    ).toBe(11_920); // 14900 × 292/365
  });
});

describe("invoice helpers", () => {
  it("lastPaidInvoice picks the latest invoice that took money", () => {
    const a = invoice({ id: "a", created: START });
    const b = invoice({ id: "b", created: START + DAY });
    const zero = invoice({ id: "zero", created: START + 2 * DAY, amount_paid: 0 });
    const open = invoice({ id: "open", created: START + 3 * DAY, status: "open" });
    expect(lastPaidInvoice([a, b, zero, open])?.id).toBe("b");
    expect(lastPaidInvoice([zero, open])).toBeNull();
  });

  it("invoiceAmountExTaxCents excludes tax and never exceeds what was paid", () => {
    expect(invoiceAmountExTaxCents(invoice())).toBe(1499);
    expect(
      invoiceAmountExTaxCents(invoice({ total_excluding_tax: null, subtotal_excluding_tax: 1400 }))
    ).toBe(1400);
    expect(
      invoiceAmountExTaxCents(invoice({ total_excluding_tax: null, subtotal_excluding_tax: null }))
    ).toBe(1799);
    // Partly paid from a customer balance: capped at the money actually paid.
    expect(invoiceAmountExTaxCents(invoice({ amount_paid: 500 }))).toBe(500);
  });

  it("invoiceServicePeriod spans the positive lines", () => {
    expect(invoiceServicePeriod(invoice())).toEqual({ start: START, end: MONTH_END });
    expect(
      invoiceServicePeriod(
        invoice({
          lines: {
            data: [
              { amount: -300, period: { start: START - 99 * DAY, end: START } },
              { amount: 1499, period: { start: START, end: MONTH_END } },
            ],
          },
        })
      )
    ).toEqual({ start: START, end: MONTH_END });
    expect(invoiceServicePeriod(invoice({ lines: { data: [] } }))).toBeNull();
  });
});

describe("planConversion", () => {
  it("credits an active subscription's unused period, then cancels", () => {
    expect(
      planConversion({ status: "active", invoices: [invoice()], now: START + 15 * DAY })
    ).toMatchObject({
      action: "credit_and_cancel",
      creditCents: 749,
      amountExTaxCents: 1499,
      periodEnd: MONTH_END,
    });
  });

  it("past_due whose last paid period is over: cancel only, no credit", () => {
    expect(
      planConversion({ status: "past_due", invoices: [invoice()], now: MONTH_END + 5 * DAY })
    ).toMatchObject({ action: "cancel_only", creditCents: 0 });
  });

  it("trialing: cancel and grant the sign-up promo", () => {
    expect(planConversion({ status: "trialing", invoices: [], now: START })).toMatchObject({
      action: "cancel_and_promo",
      creditCents: 0,
    });
  });

  it("no paid invoice: cancel only; other statuses: skip", () => {
    expect(planConversion({ status: "active", invoices: [], now: START }).action).toBe(
      "cancel_only"
    );
    expect(planConversion({ status: "canceled", invoices: [invoice()], now: START }).action).toBe(
      "skip"
    );
    expect(planConversion({ status: "incomplete", invoices: [], now: START }).action).toBe("skip");
  });
});

describe("shouldMarkFunded", () => {
  const base = {
    creditCents: 0,
    amountExTaxCents: 0,
    periodStart: null,
    periodEnd: null,
    reason: "",
  };
  it("funds only accounts that actually paid", () => {
    expect(
      shouldMarkFunded({
        ...base,
        action: "credit_and_cancel",
        creditCents: 500,
        amountExTaxCents: 1249,
      })
    ).toBe(true);
    expect(shouldMarkFunded({ ...base, action: "cancel_only", amountExTaxCents: 1249 })).toBe(true);
  });
  it("keeps a trial-then-converted account promo-only", () => {
    const trial = planConversion({ status: "trialing", invoices: [], now: 0 });
    expect(trial.action).toBe("cancel_and_promo");
    expect(shouldMarkFunded(trial)).toBe(false);
  });
  it("does not fund a subscription with no paid invoice (e.g. a 100% coupon)", () => {
    const free = planConversion({ status: "active", invoices: [], now: 0 });
    expect(free.action).toBe("cancel_only");
    expect(shouldMarkFunded(free)).toBe(false);
    expect(shouldMarkFunded({ ...base, action: "skip" })).toBe(false);
  });
});
