import { describe, expect, it, vi } from "vitest";

// The 14-day runtime-deletion wording must only appear when the deletion
// countdown really runs (WALLET_ENFORCE_ENABLED === "true"); otherwise the
// banner and the zero-balance email say servers stay paused until a top-up.

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));

import { computeWalletNudge, type WalletSignals } from "@/lib/billing/upgrade-state";
import { pausedUntilTopUpBody, withRuntimeDeletionPolicy } from "@/components/billing/banner-copy";
import { zeroBalanceDeletionDays } from "@/lib/wallet/notify";

const NOW = new Date("2026-11-01T12:00:00.000Z");

function zeroNudge(funded: boolean) {
  const signals: WalletSignals = {
    now: NOW,
    walletAvailable: true,
    paidMicros: 0,
    promoMicros: 0,
    promoExpiresAt: null,
    funded,
    autoRechargeEnabled: false,
    serverCount: 1,
    plan: "free",
    hasSubscription: false,
    subscriptionStatus: null,
    promoCap: null,
  };
  return computeWalletNudge(signals);
}

describe("banner: withRuntimeDeletionPolicy", () => {
  it("the upstream unfunded zero-balance body carries the deletion sentence", () => {
    // Pins the text the wrapper rewrites: if it changes, revisit banner-copy.ts.
    expect(zeroNudge(false).body).toMatch(/deleted after 14 days/);
  });

  it("deletion off → the strip says the server stays paused until a top-up", () => {
    const n = withRuntimeDeletionPolicy(zeroNudge(false), false);
    expect(n.body).toBe(pausedUntilTopUpBody());
    expect(n.body).not.toMatch(/deleted/i);
    expect(n.body).toMatch(/stays paused until you add credit/);
  });

  it("deletion on → the 14-day wording is kept", () => {
    expect(withRuntimeDeletionPolicy(zeroNudge(false), true).body).toMatch(/deleted after 14 days/);
  });

  it("funded accounts and other reasons are untouched", () => {
    const funded = zeroNudge(true);
    expect(withRuntimeDeletionPolicy(funded, false)).toBe(funded);
    const other = { reason: "low_balance" as const, body: "deleted after 14 days" };
    expect(withRuntimeDeletionPolicy(other, false)).toBe(other);
  });
});

describe("zero-balance email: zeroBalanceDeletionDays", () => {
  it("only an unfunded account while WALLET_ENFORCE_ENABLED is 'true'", () => {
    expect(zeroBalanceDeletionDays(false, { WALLET_ENFORCE_ENABLED: "true" })).toBe(14);
    expect(zeroBalanceDeletionDays(false, {})).toBeNull();
    expect(zeroBalanceDeletionDays(false, { WALLET_ENFORCE_ENABLED: "1" })).toBeNull();
    expect(zeroBalanceDeletionDays(true, { WALLET_ENFORCE_ENABLED: "true" })).toBeNull();
  });
});
