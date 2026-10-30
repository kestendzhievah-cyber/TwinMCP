import { describe, it, expect, beforeAll } from "vitest";

// planFromPriceId reverse-maps a Stripe price id → plan (used by the webhook to
// restore a paid plan after dunning recovery). PRICES reads env at module load,
// so set the ids before importing.
describe("planFromPriceId", () => {
  let planFromPriceId: (id: string | null | undefined) => "pro" | "team" | null;

  beforeAll(async () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_m";
    process.env.STRIPE_PRO_YEARLY_PRICE_ID = "price_pro_y";
    process.env.STRIPE_TEAM_MONTHLY_PRICE_ID = "price_team_m";
    process.env.STRIPE_TEAM_YEARLY_PRICE_ID = "price_team_y";
    ({ planFromPriceId } = await import("../lib/stripe"));
  });

  it("maps the pro price ids to pro", () => {
    expect(planFromPriceId("price_pro_m")).toBe("pro");
    expect(planFromPriceId("price_pro_y")).toBe("pro");
  });

  it("maps the team price ids to team", () => {
    expect(planFromPriceId("price_team_m")).toBe("team");
    expect(planFromPriceId("price_team_y")).toBe("team");
  });

  it("returns null for unknown ids and empty input", () => {
    expect(planFromPriceId("price_unknown")).toBeNull();
    expect(planFromPriceId("")).toBeNull();
    expect(planFromPriceId(null)).toBeNull();
    expect(planFromPriceId(undefined)).toBeNull();
  });
});

// The webhook uses this to decide a user's plan from a subscription status.
// Guards the money path — especially that a recovered past_due keeps the plan.
describe("planActionForSubscription", () => {
  let planActionForSubscription: (opts: {
    status: string;
    metadataPlan?: string | null;
    priceId?: string | null;
  }) => { kind: string; plan?: string };

  beforeAll(async () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_m";
    process.env.STRIPE_TEAM_MONTHLY_PRICE_ID = "price_team_m";
    ({ planActionForSubscription } = await import("../lib/stripe"));
  });

  it("downgrades on unpaid / canceled", () => {
    expect(planActionForSubscription({ status: "unpaid" }).kind).toBe("downgrade");
    expect(planActionForSubscription({ status: "canceled" }).kind).toBe("downgrade");
  });

  it("restores the plan from subscription metadata on active / trialing", () => {
    expect(planActionForSubscription({ status: "active", metadataPlan: "team" })).toEqual({
      kind: "restore",
      plan: "team",
    });
    expect(planActionForSubscription({ status: "trialing", metadataPlan: "pro" })).toEqual({
      kind: "restore",
      plan: "pro",
    });
  });

  it("falls back to the price id when metadata is missing", () => {
    expect(planActionForSubscription({ status: "active", priceId: "price_pro_m" })).toEqual({
      kind: "restore",
      plan: "pro",
    });
  });

  it("prefers the price id over STALE metadata (Customer Portal plan switch)", () => {
    // The customer switched pro→team in the portal: metadata is frozen at "pro"
    // but the price is now team's. The price is what they're billed → it wins.
    expect(
      planActionForSubscription({ status: "active", metadataPlan: "pro", priceId: "price_team_m" })
    ).toEqual({ kind: "restore", plan: "team" });
  });

  it("KEEPS the plan on past_due — the reactivation fix (no downgrade)", () => {
    expect(planActionForSubscription({ status: "past_due", metadataPlan: "pro" })).toEqual({
      kind: "restore",
      plan: "pro",
    });
  });

  it("leaves the plan untouched on other statuses or an unresolvable plan", () => {
    expect(planActionForSubscription({ status: "incomplete", metadataPlan: "pro" }).kind).toBe(
      "none"
    );
    expect(planActionForSubscription({ status: "active", priceId: "price_unknown" }).kind).toBe(
      "none"
    );
  });
});

// Pure helpers behind the trial → paid measurement, cancellation tracking and
// the /api/health billing probe (lib/stripe.ts). Env ids as set above.
describe("webhook + health helpers", () => {
  let lib: typeof import("../lib/stripe");

  beforeAll(async () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_m";
    process.env.STRIPE_PRO_YEARLY_PRICE_ID = "price_pro_y";
    lib = await import("../lib/stripe");
  });

  it("cadenceFromPriceId maps configured ids and rejects the rest", () => {
    expect(lib.cadenceFromPriceId("price_pro_m")).toBe("monthly");
    expect(lib.cadenceFromPriceId("price_pro_y")).toBe("yearly");
    expect(lib.cadenceFromPriceId("price_other")).toBeNull();
    expect(lib.cadenceFromPriceId("")).toBeNull();
    expect(lib.cadenceFromPriceId(null)).toBeNull();
  });

  it("cadenceFromInterval maps Stripe intervals", () => {
    expect(lib.cadenceFromInterval("year")).toBe("yearly");
    expect(lib.cadenceFromInterval("month")).toBe("monthly");
    expect(lib.cadenceFromInterval("week")).toBeNull();
    expect(lib.cadenceFromInterval(undefined)).toBeNull();
  });

  it("invoiceSubscriptionId reads the dahlia parent shape and the legacy field", () => {
    expect(
      lib.invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_1" } } })
    ).toBe("sub_1");
    expect(
      lib.invoiceSubscriptionId({
        parent: { subscription_details: { subscription: { id: "sub_2" } } },
      })
    ).toBe("sub_2");
    expect(lib.invoiceSubscriptionId({ subscription: "sub_3" })).toBe("sub_3");
    expect(lib.invoiceSubscriptionId({ parent: null })).toBeNull();
    expect(lib.invoiceSubscriptionId(null)).toBeNull();
  });

  it("invoicePriceId reads lines[].pricing.price_details.price (string or object)", () => {
    expect(
      lib.invoicePriceId({
        lines: { data: [{ pricing: { price_details: { price: "price_pro_y" } } }] },
      })
    ).toBe("price_pro_y");
    expect(
      lib.invoicePriceId({
        lines: { data: [{ pricing: { price_details: { price: { id: "price_pro_m" } } } }] },
      })
    ).toBe("price_pro_m");
    expect(lib.invoicePriceId({ lines: { data: [{ price: { id: "price_legacy" } }] } })).toBe(
      "price_legacy"
    );
    expect(lib.invoicePriceId({ lines: { data: [] } })).toBeNull();
    expect(lib.invoicePriceId({})).toBeNull();
  });

  describe("isTrialConversion", () => {
    const base = {
      amountPaid: 1499,
      billingReason: "subscription_cycle",
      storedStatus: "active",
      trialStarted: false,
      alreadyConverted: false,
    };

    it("counts the first paid invoice while the account is still mirrored as trialing", () => {
      expect(lib.isTrialConversion({ ...base, storedStatus: "trialing" })).toBe(true);
    });

    it("counts a renewal of a subscription known to have started on a trial", () => {
      expect(lib.isTrialConversion({ ...base, trialStarted: true })).toBe(true);
    });

    it("ignores plain renewals, the €0 trial invoice and repeat conversions", () => {
      expect(lib.isTrialConversion(base)).toBe(false);
      expect(lib.isTrialConversion({ ...base, storedStatus: "trialing", amountPaid: 0 })).toBe(
        false
      );
      expect(
        lib.isTrialConversion({ ...base, storedStatus: "trialing", alreadyConverted: true })
      ).toBe(false);
      expect(
        lib.isTrialConversion({
          ...base,
          trialStarted: true,
          billingReason: "subscription_create",
        })
      ).toBe(false);
    });
  });

  it("cancellationScheduled detects a cancel_at_period_end or cancel_at flip only", () => {
    expect(
      lib.cancellationScheduled({ cancel_at_period_end: false }, { cancel_at_period_end: true })
    ).toBe(true);
    expect(lib.cancellationScheduled({ cancel_at: null }, { cancel_at: 1_900_000_000 })).toBe(true);
    // Reactivation, unrelated updates and missing previous attributes are not cancellations.
    expect(
      lib.cancellationScheduled({ cancel_at_period_end: true }, { cancel_at_period_end: false })
    ).toBe(false);
    expect(lib.cancellationScheduled({}, { cancel_at_period_end: true })).toBe(false);
    expect(lib.cancellationScheduled(undefined, { cancel_at_period_end: true })).toBe(false);
  });

  it("cancellationReason prefers customer feedback, then Stripe's reason", () => {
    expect(
      lib.cancellationReason({ feedback: "too_expensive", reason: "cancellation_requested" }, "x")
    ).toBe("too_expensive");
    expect(lib.cancellationReason({ feedback: null, reason: "payment_failed" }, "x")).toBe(
      "payment_failed"
    );
    expect(lib.cancellationReason(null, "subscription_deleted")).toBe("subscription_deleted");
  });

  it("classifyPrice flags archived, one-off and wrong-interval prices", () => {
    expect(lib.classifyPrice({ active: true, recurring: { interval: "month" } }, "monthly")).toBe(
      "configured"
    );
    expect(lib.classifyPrice({ active: true, recurring: { interval: "year" } }, "yearly")).toBe(
      "configured"
    );
    expect(lib.classifyPrice({ active: true, recurring: { interval: "month" } }, "yearly")).toBe(
      "invalid"
    );
    expect(lib.classifyPrice({ active: false, recurring: { interval: "month" } }, "monthly")).toBe(
      "invalid"
    );
    expect(lib.classifyPrice({ active: true, recurring: null }, "monthly")).toBe("invalid");
    expect(lib.classifyPrice(null, "monthly")).toBe("invalid");
  });

  it("probePrice reports unconfigured without a secret key (no network)", async () => {
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      await expect(lib.probePrice("monthly")).resolves.toBe("unconfigured");
    } finally {
      if (saved !== undefined) process.env.STRIPE_SECRET_KEY = saved;
    }
  });
});
