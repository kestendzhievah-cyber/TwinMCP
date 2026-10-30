import { describe, it, expect } from "vitest";
import {
  checkTopupAmount,
  computeWalletNudge,
  expiryCountdown,
  fillCostDays,
  describeLedgerEntry,
  formatCpuTime,
  formatCredit,
  formatSignedCredit,
  isUrgent,
  isUsageKind,
  nextUtcMidnight,
  topUpCta,
  LOW_BALANCE_MICROS,
  PROMO_ALERT_DAYS,
  BILLING_HREF,
  type WalletSignals,
} from "@/lib/billing/upgrade-state";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";

const NOW = new Date("2026-10-29T10:30:00.000Z");
const DAY = 86_400_000;
const EUR = 1_000_000;

function promoOnly(over: Partial<WalletSignals> = {}): WalletSignals {
  return {
    plan: "free",
    walletAvailable: true,
    paidMicros: 0,
    promoMicros: 10 * EUR,
    promoExpiresAt: new Date(NOW.getTime() + 30 * DAY),
    funded: false,
    serverCount: 0,
    now: NOW,
    ...over,
  };
}

function funded(over: Partial<WalletSignals> = {}): WalletSignals {
  return promoOnly({
    plan: "pro",
    funded: true,
    paidMicros: 25 * EUR,
    promoMicros: 0,
    promoExpiresAt: null,
    ...over,
  });
}

describe("formatCredit", () => {
  it("formats euros with two decimals in English and French", () => {
    expect(formatCredit(12_340_000)).toBe("€12.34");
    expect(formatCredit(12_340_000, { locale: "fr" }).replace(/\s/g, " ")).toBe("12,34 €");
  });

  it("keeps sub-cent amounts visible when precise", () => {
    expect(formatCredit(30)).toBe("€0.00003");
    expect(formatCredit(1_234)).toBe("€0.001");
  });

  it("rounds to cents when not precise (balances)", () => {
    expect(formatCredit(30, { precise: false })).toBe("€0.00");
    expect(formatCredit(9_999_970, { precise: false })).toBe("€10.00");
  });

  it("never prints a negative zero and tolerates junk", () => {
    expect(formatCredit(-0)).toBe("€0.00");
    expect(formatCredit(Number.NaN)).toBe("€0.00");
  });

  it("signs ledger amounts", () => {
    expect(formatSignedCredit(10 * EUR)).toBe("+€10.00");
    expect(formatSignedCredit(-30)).toBe("−€0.00003");
    expect(formatSignedCredit(0)).toBe("€0.00");
  });
});

describe("describeLedgerEntry", () => {
  it("names each kind", () => {
    expect(describeLedgerEntry({ kind: "signup_credit" })).toBe("Free sign-up credit");
    expect(describeLedgerEntry({ kind: "topup" })).toBe("Top-up");
    expect(describeLedgerEntry({ kind: "promo_expiry" })).toBe("Free credit expired");
    expect(describeLedgerEntry({ kind: "something_new" })).toBe("Adjustment");
  });

  it("adds the call count to tool-call debits and never the note", () => {
    expect(
      describeLedgerEntry({ kind: "usage_tool_call", units: { calls: 1 }, note: "flush 3" })
    ).toBe("Tool calls · 1 call");
    expect(describeLedgerEntry({ kind: "usage_tool_call", units: { calls: "1200" } })).toBe(
      "Tool calls · 1,200 calls"
    );
  });

  it("adds the server and CPU time to compute debits", () => {
    expect(
      describeLedgerEntry({ kind: "usage_compute", units: { serverName: "prod", cpuNs: 42e9 } })
    ).toBe("Compute time · prod · 42 s CPU");
    expect(describeLedgerEntry({ kind: "usage_compute", units: { cpuSeconds: 200 } })).toBe(
      "Compute time · 3 min 20 s CPU"
    );
  });

  it("appends the note of an admin grant or adjustment", () => {
    expect(describeLedgerEntry({ kind: "admin_grant", note: "Goodwill" })).toBe(
      "Credit from TwinMCP · Goodwill"
    );
  });

  it("formats CPU time", () => {
    expect(formatCpuTime(0)).toBe("0 s");
    expect(formatCpuTime(60)).toBe("1 min");
    expect(formatCpuTime(3_900)).toBe("1 h 05 min");
  });

  it("knows the usage kinds", () => {
    expect(isUsageKind("usage_tool_call")).toBe(true);
    expect(isUsageKind("usage_compute")).toBe(true);
    expect(isUsageKind("topup")).toBe(false);
  });
});

describe("computeWalletNudge — free credit only", () => {
  it("tells a fresh account it runs on free credit", () => {
    const n = computeWalletNudge(promoOnly());
    expect(n.level).toBe("offer");
    expect(n.reason).toBe("promo_only");
    expect(n.headline).toContain("€10.00");
    expect(n.body).toContain(`${PLAN_CAPABILITIES.pro.servers} servers`);
    expect(n.cta).toEqual({ label: "Add credit", href: BILLING_HREF });
    expect(n.dismissible).toBe(true);
    expect(n.promoDaysLeft).toBe(30);
  });

  it("names the server limit once the free server exists", () => {
    const n = computeWalletNudge(promoOnly({ serverCount: PLAN_CAPABILITIES.free.servers }));
    expect(n.reason).toBe("servers_limit");
  });

  it("names the key limit when the keys are used up", () => {
    const n = computeWalletNudge(promoOnly({ keyCount: PLAN_CAPABILITIES.free.apiKeys }));
    expect(n.reason).toBe("keys_limit");
  });

  it("warns when the free credit expires within the alert window", () => {
    const n = computeWalletNudge(promoOnly({ promoExpiresAt: new Date(NOW.getTime() + 2 * DAY) }));
    expect(n.level).toBe("trial");
    expect(n.reason).toBe("promo_expiring");
    expect(n.headline).toBe("Your free credit expires in 2 days");
    expect(n.body).toContain("Add credit");
  });

  it("does not warn about expiry outside the window", () => {
    const n = computeWalletNudge(
      promoOnly({ promoExpiresAt: new Date(NOW.getTime() + (PROMO_ALERT_DAYS + 1) * DAY) })
    );
    expect(n.reason).toBe("promo_only");
  });

  it("is urgent and not dismissible at zero, with the deletion rule", () => {
    const n = computeWalletNudge(promoOnly({ promoMicros: 0 }));
    expect(n.level).toBe("limit");
    expect(n.reason).toBe("zero_balance");
    expect(n.dismissible).toBe(false);
    expect(n.cta.label).toBe("Top up to continue");
    expect(n.body).toContain("deleted after 14 days");
    expect(isUrgent(n.level)).toBe(true);
  });

  it("warns below the low-balance line", () => {
    const n = computeWalletNudge(promoOnly({ promoMicros: LOW_BALANCE_MICROS - 1 }));
    expect(n.level).toBe("warning");
    expect(n.reason).toBe("low_balance");
    expect(n.headline).toBe("€2.00 of credit left");
  });
});

describe("computeWalletNudge — funded accounts", () => {
  it("stays quiet with a healthy balance", () => {
    const n = computeWalletNudge(funded());
    expect(n.level).toBe("none");
    expect(n.totalMicros).toBe(25 * EUR);
  });

  it("counts a negative paid balance as zero credit", () => {
    const n = computeWalletNudge(funded({ paidMicros: -300 }));
    expect(n.level).toBe("limit");
    expect(n.headline).toBe("Your credit is used up");
    expect(n.body).not.toContain("deleted");
  });

  it("mentions auto-recharge when it is on", () => {
    const n = computeWalletNudge(funded({ paidMicros: 1 * EUR, autoRechargeEnabled: true }));
    expect(n.reason).toBe("low_balance");
    expect(n.body).toContain("Auto-recharge is on");
  });

  it("warns about leftover free credit expiring without pushing a top-up", () => {
    const n = computeWalletNudge(
      funded({ promoMicros: 3 * EUR, promoExpiresAt: new Date(NOW.getTime() + DAY / 2) })
    );
    expect(n.reason).toBe("promo_expiring");
    expect(n.headline).toBe("Your free credit expires in 1 day");
    expect(n.body).not.toContain("Add credit");
  });
});

describe("computeWalletNudge — legacy subscriptions and failures", () => {
  it("announces the conversion before anything else", () => {
    const n = computeWalletNudge(
      funded({ paidMicros: 0, subscriptionStatus: "active", hasSubscription: true })
    );
    expect(n.level).toBe("info");
    expect(n.reason).toBe("legacy_subscription");
    expect(n.headline).toBe("Your subscription will be converted to credit");
    expect(n.legacySubscription).toBe(true);
  });

  it("flags a past-due legacy subscription as urgent", () => {
    const n = computeWalletNudge(funded({ subscriptionStatus: "past_due", hasSubscription: true }));
    expect(n.level).toBe("past_due");
    expect(n.dismissible).toBe(false);
  });

  it("ignores a cancelled subscription", () => {
    const n = computeWalletNudge(funded({ subscriptionStatus: "canceled", hasSubscription: true }));
    expect(n.legacySubscription).toBe(false);
    expect(n.level).toBe("none");
  });

  it("stays quiet when the wallet could not be read", () => {
    const n = computeWalletNudge(promoOnly({ walletAvailable: false, promoMicros: 0 }));
    expect(n.level).toBe("none");
  });
});

describe("helpers", () => {
  it("nextUtcMidnight is the next UTC day boundary", () => {
    expect(nextUtcMidnight(NOW).toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });

  it("the top-up CTA points at the wallet", () => {
    expect(topUpCta()).toEqual({ label: "Add credit", href: BILLING_HREF });
    expect(topUpCta("zero_balance").label).toBe("Top up to continue");
  });
});

describe("credits page helpers", () => {
  it("counts down to the promo expiry", () => {
    expect(expiryCountdown(new Date(NOW.getTime() + 12 * DAY - 1000), NOW)).toBe("in 12 days");
    expect(expiryCountdown(new Date(NOW.getTime() + 5 * 3_600_000 + 1), NOW)).toBe("in 5 hours");
    expect(expiryCountdown(new Date(NOW.getTime() + 60_000), NOW)).toBe("within the hour");
    expect(expiryCountdown(new Date(NOW.getTime() - 1), NOW)).toBe("expired");
  });

  it("checks a custom top-up amount", () => {
    expect(checkTopupAmount("25", 10, 1000)).toEqual({ ok: true, amountEur: 25 });
    expect(checkTopupAmount(" 10 ", 10, 1000)).toEqual({ ok: true, amountEur: 10 });
    expect(checkTopupAmount("9", 10, 1000)).toMatchObject({ ok: false });
    expect(checkTopupAmount("1001", 10, 1000)).toMatchObject({ ok: false });
    expect(checkTopupAmount("12,5", 10, 1000)).toMatchObject({
      ok: false,
      message: "Use a whole number of euros.",
    });
    expect(checkTopupAmount("", 10, 1000)).toMatchObject({ ok: false });
    expect(checkTopupAmount("abc", 10, 1000)).toMatchObject({ ok: false });
  });

  it("fills the cost days, oldest first, with zeros", () => {
    const days = fillCostDays(
      [
        { day: "2026-10-29", toolCallsMicros: 300, computeMicros: 1_200_000 },
        { day: "2026-10-27", toolCallsMicros: -5, computeMicros: 10 },
      ],
      NOW,
      3
    );
    expect(days).toEqual([
      { day: "2026-10-27", toolCallsMicros: 0, computeMicros: 10 },
      { day: "2026-10-28", toolCallsMicros: 0, computeMicros: 0 },
      { day: "2026-10-29", toolCallsMicros: 300, computeMicros: 1_200_000 },
    ]);
  });
});

describe("computeWalletNudge — promo compute cap", () => {
  it("explains a server paused by the daily cap while free credit is left", () => {
    const n = computeWalletNudge(promoOnly({ promoCap: "daily" }));
    expect(n.reason).toBe("promo_cap");
    expect(n.level).toBe("warning");
    expect(n.dismissible).toBe(false);
    expect(n.headline).toMatch(/today's compute limit/);
    expect(n.body).toMatch(/tomorrow/);
  });

  it("the total cap points to a first top-up", () => {
    const n = computeWalletNudge(promoOnly({ promoCap: "total" }));
    expect(n.reason).toBe("promo_cap");
    expect(n.body).toMatch(/first top-up lifts the limit/);
  });

  it("never applies to a funded account, and zero balance wins", () => {
    expect(computeWalletNudge(funded({ promoCap: "total" })).reason).not.toBe("promo_cap");
    expect(computeWalletNudge(promoOnly({ promoCap: "daily", promoMicros: 0 })).reason).toBe(
      "zero_balance"
    );
  });
});
