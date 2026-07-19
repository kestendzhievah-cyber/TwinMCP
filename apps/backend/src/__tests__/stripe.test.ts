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
