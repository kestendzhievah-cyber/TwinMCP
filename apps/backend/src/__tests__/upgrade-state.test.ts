import { describe, it, expect } from "vitest";
import {
  computeUpgradeNudge,
  nextUtcMidnight,
  isUrgent,
  WARN_PCT,
  type UpgradeSignals,
} from "@/lib/billing/upgrade-state";
import { PLAN_CAPABILITIES, PRO_TRIAL_DAYS } from "@/lib/plan-features";

const NOW = new Date("2026-10-24T10:30:00.000Z");

function free(over: Partial<UpgradeSignals> = {}): UpgradeSignals {
  return {
    plan: "free",
    usedToday: 0,
    dailyLimit: 50,
    proDailyLimit: 5000,
    serverCount: 0,
    hasStripeCustomer: false,
    now: NOW,
    ...over,
  };
}

describe("computeUpgradeNudge — Free accounts", () => {
  it("offers the free month to a fresh Free account", () => {
    const n = computeUpgradeNudge(free());
    expect(n.level).toBe("offer");
    expect(n.reason).toBe("offer");
    expect(n.trialEligible).toBe(true);
    expect(n.trialDays).toBe(PRO_TRIAL_DAYS);
    expect(n.cta.label).toBe("Start my free month of Pro");
    expect(n.cta.href).toBe("/dashboard/billing");
    expect(n.dismissible).toBe(true);
    expect(n.body).toContain("5,000");
  });

  it("drops the trial wording once a Stripe customer exists", () => {
    const n = computeUpgradeNudge(free({ hasStripeCustomer: true }));
    expect(n.trialEligible).toBe(false);
    expect(n.trialDays).toBe(0);
    expect(n.cta.label).toBe("Upgrade to Pro");
    expect(n.headline).not.toContain("free");
  });

  it(`warns at ${WARN_PCT}% of the daily quota`, () => {
    const n = computeUpgradeNudge(free({ usedToday: 40 }));
    expect(n.level).toBe("warning");
    expect(n.reason).toBe("quota_warning");
    expect(n.quotaPct).toBe(80);
    expect(n.headline).toBe("40 of 50 tool calls used today");
    expect(n.dismissible).toBe(true);
  });

  it("stays quiet just under the warning threshold", () => {
    const n = computeUpgradeNudge(free({ usedToday: 39 }));
    expect(n.level).toBe("offer");
  });

  it("escalates to a non-dismissible limit nudge at 100%", () => {
    const n = computeUpgradeNudge(free({ usedToday: 50 }));
    expect(n.level).toBe("limit");
    expect(n.reason).toBe("quota_limit");
    expect(n.quotaPct).toBe(100);
    expect(n.dismissible).toBe(false);
    expect(isUrgent(n.level)).toBe(true);
    expect(n.body).toContain("midnight UTC");
  });

  it("caps the percentage above the limit", () => {
    const n = computeUpgradeNudge(free({ usedToday: 120 }));
    expect(n.quotaPct).toBe(100);
    expect(n.level).toBe("limit");
  });

  it("points at the server limit when the one Free server is used", () => {
    const n = computeUpgradeNudge(free({ serverCount: PLAN_CAPABILITIES.free.servers }));
    expect(n.level).toBe("offer");
    expect(n.reason).toBe("servers_limit");
    expect(n.body).toContain(`${PLAN_CAPABILITIES.pro.servers} servers`);
  });

  it("points at the key limit when all Free keys are used", () => {
    const n = computeUpgradeNudge(free({ keyCount: PLAN_CAPABILITIES.free.apiKeys }));
    expect(n.reason).toBe("keys_limit");
    expect(n.body).toContain(`${PLAN_CAPABILITIES.pro.apiKeys}`);
  });

  it("quota beats the server limit", () => {
    const n = computeUpgradeNudge(free({ usedToday: 45, serverCount: 1 }));
    expect(n.reason).toBe("quota_warning");
  });

  it("computes the next UTC midnight as the reset time", () => {
    const n = computeUpgradeNudge(free());
    expect(n.resetsAt.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(nextUtcMidnight(new Date("2026-10-24T23:59:59.000Z")).toISOString()).toBe(
      "2026-10-25T00:00:00.000Z"
    );
  });
});

describe("computeUpgradeNudge — paid accounts", () => {
  it("says nothing to an active Pro account", () => {
    const n = computeUpgradeNudge(
      free({ plan: "pro", dailyLimit: 5000, hasStripeCustomer: true, subscriptionStatus: "active" })
    );
    expect(n.level).toBe("none");
    expect(n.trialEligible).toBe(false);
  });

  it("stays quiet early in the trial", () => {
    const n = computeUpgradeNudge(
      free({
        plan: "pro",
        dailyLimit: 5000,
        hasStripeCustomer: true,
        subscriptionStatus: "trialing",
        currentPeriodEnd: "2026-11-20T10:30:00.000Z",
      })
    );
    expect(n.level).toBe("none");
    expect(n.trialDaysLeft).toBe(27);
    expect(n.trialEndsAt?.toISOString()).toBe("2026-11-20T10:30:00.000Z");
  });

  it("alerts when the trial ends within a week", () => {
    const n = computeUpgradeNudge(
      free({
        plan: "pro",
        dailyLimit: 5000,
        hasStripeCustomer: true,
        subscriptionStatus: "trialing",
        currentPeriodEnd: "2026-10-27T10:30:00.000Z",
      })
    );
    expect(n.level).toBe("trial");
    expect(n.reason).toBe("trial_ending");
    expect(n.trialDaysLeft).toBe(3);
    expect(n.headline).toBe("Your free month of Pro ends in 3 days");
    expect(n.body).toContain("27 October");
    expect(n.dismissible).toBe(true);
  });

  it("uses the singular on the last day", () => {
    const n = computeUpgradeNudge(
      free({
        plan: "pro",
        dailyLimit: 5000,
        hasStripeCustomer: true,
        subscriptionStatus: "trialing",
        currentPeriodEnd: "2026-10-25T09:00:00.000Z",
      })
    );
    expect(n.headline).toBe("Your free month of Pro ends in 1 day");
  });

  it("stays quiet when the ending trial was already cancelled", () => {
    const n = computeUpgradeNudge(
      free({
        plan: "pro",
        dailyLimit: 5000,
        hasStripeCustomer: true,
        subscriptionStatus: "trialing",
        currentPeriodEnd: "2026-10-27T10:30:00.000Z",
        cancelAtPeriodEnd: true,
      })
    );
    expect(n.level).toBe("none");
    // The overview badge still knows when the trial ends.
    expect(n.trialEndsAt?.toISOString()).toBe("2026-10-27T10:30:00.000Z");
    expect(n.trialDaysLeft).toBe(3);
  });

  it("flags a failed payment as urgent", () => {
    for (const status of ["past_due", "unpaid"]) {
      const n = computeUpgradeNudge(
        free({ plan: "pro", dailyLimit: 5000, hasStripeCustomer: true, subscriptionStatus: status })
      );
      expect(n.level).toBe("past_due");
      expect(n.dismissible).toBe(false);
      expect(isUrgent(n.level)).toBe(true);
      expect(n.cta.label).toBe("Update payment method");
    }
  });

  it("never shows Free copy to a grandfathered Team account", () => {
    const n = computeUpgradeNudge(
      free({
        plan: "team",
        dailyLimit: 5000,
        hasStripeCustomer: true,
        subscriptionStatus: "active",
      })
    );
    expect(n.level).toBe("none");
  });
});
