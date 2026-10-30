import { describe, expect, it } from "vitest";
import {
  PLAN_CAPABILITIES,
  can,
  entitlementTier,
  isBoxSizeAllowed,
  isFundedAccount,
  isPayingSubscription,
  keepWarm,
  limitFor,
  resolveEntitlements,
} from "@/lib/plan-features";
import { isPromoOnly } from "@/lib/wallet/eligibility";
import { isFunded } from "@/lib/wallet/compute-meter";

// Every server-side gate (server quota, box sizes, publishing MCPs, the promo
// MCP restrictions, warm boxes) resolves its tier from the WALLET through
// resolveEntitlements (lib/wallet/entitlements.ts getEntitlements feeds it),
// never from users.plan: billing never downgrades the plan, so a trial that
// never paid can still carry plan='pro'.

const FUNDED_AT = new Date("2026-10-30T12:00:00.000Z");

describe("resolveEntitlements — matrix", () => {
  it("never-paid 'pro' row (lapsed trial) gets the Free-credit limits", () => {
    const e = resolveEntitlements({ plan: "pro", fundedAt: null, subscriptionStatus: "canceled" });
    expect(e.tier).toBe("free");
    expect(e.displayPlan).toBe("pro");
    expect(e.funded).toBe(false);
    expect(e.promoOnly).toBe(true);
    expect(e.capabilities).toEqual(PLAN_CAPABILITIES.free);
    expect(limitFor(e.tier, "servers")).toBe(1);
    expect(isBoxSizeAllowed(e.tier, "large")).toBe(false);
    expect(can(e.tier, "publishMcp")).toBe(false);
    expect(keepWarm(e.tier, true)).toBe(false);
  });

  it("a trial still running (trialing) has paid nothing: Free-credit limits", () => {
    const e = resolveEntitlements({ plan: "pro", fundedAt: null, subscriptionStatus: "trialing" });
    expect(e.tier).toBe("free");
    expect(e.promoOnly).toBe(true);
  });

  it("never-paid 'pro' row with no subscription status at all", () => {
    const e = resolveEntitlements({ plan: "pro", fundedAt: null, subscriptionStatus: null });
    expect(e.tier).toBe("free");
  });

  it("funded wallet (first paid top-up) gets Pay as you go, whatever users.plan says", () => {
    const e = resolveEntitlements({ plan: "free", fundedAt: FUNDED_AT, subscriptionStatus: null });
    expect(e.tier).toBe("pro");
    expect(e.displayPlan).toBe("free");
    expect(e.funded).toBe(true);
    expect(e.promoOnly).toBe(false);
    expect(limitFor(e.tier, "servers")).toBe(PLAN_CAPABILITIES.pro.servers);
    expect(isBoxSizeAllowed(e.tier, "large")).toBe(true);
    expect(can(e.tier, "publishMcp")).toBe(true);
  });

  it("funded_at as an ISO string counts too", () => {
    const e = resolveEntitlements({
      plan: "pro",
      fundedAt: FUNDED_AT.toISOString(),
      subscriptionStatus: null,
    });
    expect(e.tier).toBe("pro");
  });

  it("a live paying legacy subscription (active / past_due) is funded", () => {
    for (const status of ["active", "past_due"]) {
      const e = resolveEntitlements({ plan: "pro", fundedAt: null, subscriptionStatus: status });
      expect(e.tier).toBe("pro");
      expect(e.funded).toBe(true);
      expect(e.promoOnly).toBe(false);
    }
  });

  it("promo-only account (sign-up credit only) gets the Free-credit limits", () => {
    const e = resolveEntitlements({ plan: "free", fundedAt: null, subscriptionStatus: null });
    expect(e.tier).toBe("free");
    expect(e.promoOnly).toBe(true);
    expect(isBoxSizeAllowed(e.tier, "small")).toBe(true);
    expect(isBoxSizeAllowed(e.tier, "medium")).toBe(false);
  });

  it("grandfathered Team stays Team only while funded", () => {
    expect(
      resolveEntitlements({ plan: "team", fundedAt: null, subscriptionStatus: "active" }).tier
    ).toBe("team");
    expect(
      resolveEntitlements({ plan: "team", fundedAt: FUNDED_AT, subscriptionStatus: "canceled" })
        .tier
    ).toBe("team");
    expect(
      resolveEntitlements({ plan: "team", fundedAt: null, subscriptionStatus: "canceled" }).tier
    ).toBe("free");
  });

  it("a missing plan reads as free", () => {
    const e = resolveEntitlements({
      plan: null,
      fundedAt: undefined,
      subscriptionStatus: undefined,
    });
    expect(e.tier).toBe("free");
    expect(e.displayPlan).toBe("free");
  });
});

describe("one funded rule everywhere", () => {
  const cases: Array<[Date | null, string | null, boolean]> = [
    [null, null, false],
    [null, "trialing", false],
    [null, "canceled", false],
    [null, "unpaid", false],
    [null, "incomplete", false],
    [null, "active", true],
    [null, "past_due", true],
    [FUNDED_AT, null, true],
    [FUNDED_AT, "canceled", true],
  ];
  it.each(cases)("fundedAt=%s status=%s → funded %s", (fundedAt, status, funded) => {
    expect(isFundedAccount(fundedAt, status)).toBe(funded);
    expect(isFunded(fundedAt, status)).toBe(funded);
    expect(isPromoOnly({ funded: fundedAt !== null }, status)).toBe(!funded);
    expect(resolveEntitlements({ plan: "pro", fundedAt, subscriptionStatus: status }).funded).toBe(
      funded
    );
  });

  it("isPayingSubscription only accepts active and past_due", () => {
    expect(isPayingSubscription("active")).toBe(true);
    expect(isPayingSubscription("past_due")).toBe(true);
    expect(isPayingSubscription("trialing")).toBe(false);
    expect(isPayingSubscription("")).toBe(false);
    expect(isPayingSubscription(null)).toBe(false);
    expect(isPayingSubscription(undefined)).toBe(false);
  });
});

describe("entitlementTier — the tier for callers that already hold `funded`", () => {
  it("is free unless funded, pro when funded, team for a funded Team account", () => {
    for (const plan of ["free", "pro", "team", null, undefined] as const) {
      expect(entitlementTier(plan, false)).toBe("free");
    }
    expect(entitlementTier("free", true)).toBe("pro");
    expect(entitlementTier("pro", true)).toBe("pro");
    expect(entitlementTier(null, true)).toBe("pro");
    expect(entitlementTier("team", true)).toBe("team");
  });

  it("agrees with resolveEntitlements for every plan × funding state", () => {
    for (const plan of ["free", "pro", "team"] as const) {
      for (const fundedAt of [null, FUNDED_AT]) {
        const e = resolveEntitlements({ plan, fundedAt, subscriptionStatus: null });
        expect(entitlementTier(plan, e.funded)).toBe(e.tier);
      }
    }
  });
});
