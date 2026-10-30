import { describe, it, expect, vi } from "vitest";

// selectNudgeCandidates is pure, but the module also wires the DB, Resend,
// PostHog and Sentry for the runners — keep those out of the test.
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendActivationEmail: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Only the docs slug is needed (the SQL excludes it); the module itself pulls
// the Upstash Box client.
vi.mock("@/lib/provisioning", () => ({ TWINMCP_DOCS_SLUG: "twinmcp-docs" }));

import {
  selectNudgeCandidates,
  walletCandidates,
  ACTIVATION_EMAIL_DELAY_HOURS,
  ACTIVATION_EMAIL_MAX_AGE_DAYS,
  NUDGE_COOLDOWN_DAYS,
  type CandidateRow,
  type CandidateWallet,
} from "@/lib/billing/nudge-job";
import { stampedNudgeState } from "@/lib/billing/nudge-state";
import { RUNTIME_DELETION_AFTER_DAYS } from "@/lib/billing/upgrade-state";

const NOW = new Date("2026-10-29T08:00:00.000Z");
const DAY = 86_400_000;
const HOUR = 3_600_000;
const EUR = 1_000_000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function wallet(over: Partial<CandidateWallet> = {}): CandidateWallet {
  return {
    paidMicros: 0,
    promoMicros: 6 * EUR,
    promoExpiresAt: new Date(NOW.getTime() + 20 * DAY),
    funded: false,
    zeroBalanceAt: null,
    autoRechargeEnabled: false,
    notified: {},
    lastCreditAt: daysAgo(10),
    ...over,
  };
}

/** A 10-day-old account on free credit, with one server in use. */
function row(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    userId: "u1",
    email: "dev@example.com",
    plan: "free",
    createdAt: daysAgo(10),
    metadata: { firstToolCallAt: daysAgo(9).toISOString() },
    serverCount: 1,
    mcpCount: 1,
    requests7d: 37,
    wallet: wallet(),
    ...over,
  };
}

describe("selectNudgeCandidates — promo reminders", () => {
  it("says nothing to a healthy account", () => {
    expect(selectNudgeCandidates([row()], NOW)).toEqual([]);
  });

  it("sends the 7-day reminder inside the window", () => {
    const r = row({ wallet: wallet({ promoExpiresAt: new Date(NOW.getTime() + 6 * DAY) }) });
    const out = selectNudgeCandidates([r], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "promo_expiring_7d", userId: "u1" });
  });

  it("switches to the 2-day reminder in the last two days", () => {
    const r = row({ wallet: wallet({ promoExpiresAt: new Date(NOW.getTime() + 36 * HOUR) }) });
    expect(selectNudgeCandidates([r], NOW)[0].kind).toBe("promo_expiring_2d");
  });

  it("does not repeat a reminder already sent for this expiry", () => {
    const expiresAt = new Date(NOW.getTime() + 6 * DAY);
    const r = row({
      wallet: wallet({
        promoExpiresAt: expiresAt,
        notified: {
          promo_expiring_7d: { at: daysAgo(1).toISOString(), ref: expiresAt.toISOString() },
        },
      }),
    });
    expect(selectNudgeCandidates([r], NOW)).toEqual([]);
  });

  it("skips promo reminders for an account that opted out of nudges", () => {
    const r = row({
      metadata: { emailNudges: false },
      wallet: wallet({ promoExpiresAt: new Date(NOW.getTime() + 6 * DAY) }),
    });
    expect(selectNudgeCandidates([r], NOW)).toEqual([]);
  });
});

describe("selectNudgeCandidates — balance notices", () => {
  it("catches up a low balance", () => {
    const r = row({ wallet: wallet({ promoMicros: 1 * EUR }) });
    expect(selectNudgeCandidates([r], NOW)[0].kind).toBe("low_balance");
  });

  it("falls through to the promo reminder when the low-balance notice was already sent", () => {
    const r = row({
      wallet: wallet({
        promoMicros: 1 * EUR,
        promoExpiresAt: new Date(NOW.getTime() + DAY),
        notified: { low_balance: { at: daysAgo(1).toISOString() } },
      }),
    });
    expect(selectNudgeCandidates([r], NOW)[0].kind).toBe("promo_expiring_2d");
  });

  it("leaves runtime-deletion warnings to the wallet enforcer", () => {
    for (const days of [0, 8, 13]) {
      const r = row({ wallet: wallet({ promoMicros: 0, zeroBalanceAt: daysAgo(days) }) });
      const kinds = walletCandidates(r, NOW).map((c) => c.event);
      expect(kinds).not.toContain("runtime_deletion_warning");
      expect(selectNudgeCandidates([r], NOW)[0].kind).toBe("zero_balance");
    }
  });

  it("stops warning once the deletion date has passed", () => {
    const r = row({
      wallet: wallet({
        promoMicros: 0,
        zeroBalanceAt: daysAgo(RUNTIME_DELETION_AFTER_DAYS + 1),
        lastCreditAt: daysAgo(30),
        notified: { zero_balance: { at: daysAgo(RUNTIME_DELETION_AFTER_DAYS).toISOString() } },
      }),
    });
    expect(selectNudgeCandidates([r], NOW)).toEqual([]);
  });

  it("does not warn a stage twice for the same zero episode", () => {
    const zeroAt = daysAgo(8);
    const r = row({
      wallet: wallet({
        promoMicros: 0,
        zeroBalanceAt: zeroAt,
        notified: {
          "runtime_deletion_warning:7": { at: daysAgo(1).toISOString(), ref: zeroAt.toISOString() },
          zero_balance: { at: daysAgo(8).toISOString() },
        },
      }),
    });
    expect(selectNudgeCandidates([r], NOW)).toEqual([]);
  });

  it("sends a funded account the zero-balance notice, never a deletion warning", () => {
    const r = row({
      plan: "pro",
      wallet: wallet({ funded: true, promoMicros: 0, paidMicros: -40, zeroBalanceAt: daysAgo(2) }),
    });
    const out = selectNudgeCandidates([r], NOW);
    expect(out.map((d) => d.kind)).toEqual(["zero_balance"]);
  });

  it("sends money-critical notices even to an opted-out account", () => {
    const r = row({
      metadata: { emailNudges: false },
      wallet: wallet({ promoMicros: 0, zeroBalanceAt: daysAgo(0) }),
    });
    expect(selectNudgeCandidates([r], NOW)[0].kind).toBe("zero_balance");
  });

  it("lists the qualifying notices loudest first", () => {
    const r = row({
      wallet: wallet({
        promoMicros: 1 * EUR,
        promoExpiresAt: new Date(NOW.getTime() + DAY),
      }),
    });
    expect(walletCandidates(r, NOW).map((c) => c.event)).toEqual([
      "low_balance",
      "promo_expiring_2d",
    ]);
  });
});

describe("selectNudgeCandidates — activation reminder", () => {
  function young(over: Partial<CandidateRow> = {}): CandidateRow {
    return row({
      createdAt: new Date(NOW.getTime() - (ACTIVATION_EMAIL_DELAY_HOURS + 2) * HOUR),
      metadata: {},
      requests7d: 0,
      serverCount: 0,
      mcpCount: 0,
      ...over,
    });
  }

  it("reminds a young account with no tool call", () => {
    const out = selectNudgeCandidates([young()], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("activation");
  });

  it("waits for the delay and stops after the first week", () => {
    expect(
      selectNudgeCandidates([young({ createdAt: new Date(NOW.getTime() - 2 * HOUR) })], NOW)
    ).toEqual([]);
    expect(
      selectNudgeCandidates([young({ createdAt: daysAgo(ACTIVATION_EMAIL_MAX_AGE_DAYS) })], NOW)
    ).toEqual([]);
  });

  it("is sent once and respects the shared cooldown", () => {
    const stamped = stampedNudgeState({}, "activation", daysAgo(NUDGE_COOLDOWN_DAYS + 1));
    expect(selectNudgeCandidates([young({ metadata: { nudges: stamped } })], NOW)).toEqual([]);
  });

  it("is dropped by the wallet-only run", () => {
    expect(selectNudgeCandidates([young()], NOW, { walletOnly: true })).toEqual([]);
  });

  it("never emails placeholder addresses", () => {
    expect(selectNudgeCandidates([young({ email: "u1@placeholder.twinmcp.fr" })], NOW)).toEqual([]);
  });
});

describe("selectNudgeCandidates — ordering", () => {
  it("puts money-critical notices first, then the oldest accounts", () => {
    const promo = row({
      userId: "promo",
      createdAt: daysAgo(30),
      wallet: wallet({ promoExpiresAt: new Date(NOW.getTime() + 6 * DAY) }),
    });
    const zero = row({
      userId: "zero",
      createdAt: daysAgo(3),
      wallet: wallet({ promoMicros: 0, zeroBalanceAt: daysAgo(1) }),
    });
    const low = row({
      userId: "low",
      createdAt: daysAgo(20),
      wallet: wallet({ promoMicros: 1 * EUR }),
    });
    expect(selectNudgeCandidates([promo, low, zero], NOW).map((d) => d.userId)).toEqual([
      "zero",
      "promo",
      "low",
    ]);
  });
});
