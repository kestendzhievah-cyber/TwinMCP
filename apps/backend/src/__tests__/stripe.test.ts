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
