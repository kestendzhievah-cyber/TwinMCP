import { describe, it, expect, vi } from "vitest";

// selectNudgeCandidates is pure, but the module also wires the DB, Resend,
// PostHog and Sentry for runUpgradeNudges — keep those out of the test.
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendActivationEmail: vi.fn(),
  sendProOfferEmail: vi.fn(),
  sendQuotaLimitEmail: vi.fn(),
}));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  getDailyLimit: (plan: string) => (plan === "free" ? 50 : 5000),
}));
// Only the docs slug is needed (the SQL excludes it); the module itself pulls
// the Upstash Box client.
vi.mock("@/lib/provisioning", () => ({ TWINMCP_DOCS_SLUG: "twinmcp-docs" }));

import {
  selectNudgeCandidates,
  NUDGE_COOLDOWN_DAYS,
  QUOTA_NUDGE_REPEAT_DAYS,
  ACTIVATION_MIN_AGE_DAYS,
  QUOTA_LIMIT_MIN_DAYS,
  ACTIVATION_EMAIL_DELAY_HOURS,
  ACTIVATION_EMAIL_MAX_AGE_DAYS,
  type CandidateRow,
} from "@/lib/billing/nudge-job";
import { firstToolCallAt, stampedNudgeState } from "@/lib/billing/nudge-state";

const NOW = new Date("2026-10-24T09:00:00.000Z");
const DAY = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

/** An activated Free account: 10 days old, one server, one MCP, real usage. */
function activated(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    userId: "u1",
    email: "dev@example.com",
    plan: "free",
    createdAt: daysAgo(10),
    stripeCustomerId: null,
    metadata: {},
    serverCount: 1,
    mcpCount: 1,
    requests7d: 37,
    daysAtLimit7d: 0,
    ...over,
  };
}

describe("selectNudgeCandidates — the Pro offer", () => {
  it("offers Pro to an activated Free account", () => {
    const out = selectNudgeCandidates([activated()], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      userId: "u1",
      email: "dev@example.com",
      kind: "offer",
      reason: "offer",
    });
  });

  it("sends the offer only once, ever", () => {
    const row = activated({ metadata: { nudges: { offerAt: daysAgo(60).toISOString() } } });
    expect(selectNudgeCandidates([row], NOW)).toEqual([]);
  });

  it("needs a live server", () => {
    expect(selectNudgeCandidates([activated({ serverCount: 0 })], NOW)).toEqual([]);
  });

  it("needs an installed MCP", () => {
    expect(selectNudgeCandidates([activated({ mcpCount: 0 })], NOW)).toEqual([]);
  });

  it("needs requests in the last 7 days", () => {
    expect(selectNudgeCandidates([activated({ requests7d: 0 })], NOW)).toEqual([]);
  });

  it("waits until the account is 3 days old", () => {
    const young = activated({ createdAt: daysAgo(ACTIVATION_MIN_AGE_DAYS - 0.5) });
    expect(selectNudgeCandidates([young], NOW)).toEqual([]);
    const old = activated({ createdAt: daysAgo(ACTIVATION_MIN_AGE_DAYS) });
    expect(selectNudgeCandidates([old], NOW)).toHaveLength(1);
  });
});

describe("selectNudgeCandidates — the quota-limit nudge", () => {
  it("fires after two days at the Free limit", () => {
    const row = activated({ daysAtLimit7d: QUOTA_LIMIT_MIN_DAYS });
    const out = selectNudgeCandidates([row], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("quota_limit");
    expect(out[0].reason).toBe("quota_limit");
  });

  it("does not fire on a single day at the limit", () => {
    const row = activated({
      daysAtLimit7d: 1,
      metadata: { nudges: { offerAt: daysAgo(30).toISOString() } },
    });
    expect(selectNudgeCandidates([row], NOW)).toEqual([]);
  });

  it("wins over the offer when both apply", () => {
    const row = activated({ daysAtLimit7d: 3 });
    expect(selectNudgeCandidates([row], NOW)[0].kind).toBe("quota_limit");
  });

  it("is not repeated within 14 days", () => {
    const recent = activated({
      daysAtLimit7d: 3,
      metadata: {
        nudges: {
          quotaLimitAt: daysAgo(QUOTA_NUDGE_REPEAT_DAYS - 1).toISOString(),
          lastEmailAt: daysAgo(QUOTA_NUDGE_REPEAT_DAYS - 1).toISOString(),
          offerAt: daysAgo(40).toISOString(),
        },
      },
    });
    expect(selectNudgeCandidates([recent], NOW)).toEqual([]);

    const stale = activated({
      daysAtLimit7d: 3,
      metadata: {
        nudges: {
          quotaLimitAt: daysAgo(QUOTA_NUDGE_REPEAT_DAYS).toISOString(),
          lastEmailAt: daysAgo(QUOTA_NUDGE_REPEAT_DAYS).toISOString(),
          offerAt: daysAgo(40).toISOString(),
        },
      },
    });
    expect(selectNudgeCandidates([stale], NOW).map((d) => d.kind)).toEqual(["quota_limit"]);
  });

  it("falls back to the offer when the quota nudge was sent recently", () => {
    // Quota nudge 10 days ago (inside the 14-day repeat window) but outside the
    // 7-day global cooldown, and the offer was never sent.
    const row = activated({
      daysAtLimit7d: 3,
      metadata: {
        nudges: { quotaLimitAt: daysAgo(10).toISOString(), lastEmailAt: daysAgo(10).toISOString() },
      },
    });
    expect(selectNudgeCandidates([row], NOW).map((d) => d.kind)).toEqual(["offer"]);
  });
});

describe("selectNudgeCandidates — cooldown, opt-out and exclusions", () => {
  it("enforces the 7-day global cooldown on every kind", () => {
    const quota = activated({
      daysAtLimit7d: 3,
      metadata: { nudges: { lastEmailAt: daysAgo(NUDGE_COOLDOWN_DAYS - 1).toISOString() } },
    });
    const offer = activated({
      userId: "u2",
      metadata: { nudges: { lastEmailAt: daysAgo(NUDGE_COOLDOWN_DAYS - 1).toISOString() } },
    });
    expect(selectNudgeCandidates([quota, offer], NOW)).toEqual([]);

    const cooled = activated({
      metadata: { nudges: { lastEmailAt: daysAgo(NUDGE_COOLDOWN_DAYS).toISOString() } },
    });
    expect(selectNudgeCandidates([cooled], NOW)).toHaveLength(1);
  });

  it("respects metadata.emailNudges === false", () => {
    const optedOut = activated({ daysAtLimit7d: 5, metadata: { emailNudges: false } });
    expect(selectNudgeCandidates([optedOut], NOW)).toEqual([]);
  });

  it("treats a missing emailNudges flag as opted in", () => {
    expect(selectNudgeCandidates([activated({ metadata: {} })], NOW)).toHaveLength(1);
    expect(selectNudgeCandidates([activated({ metadata: null })], NOW)).toHaveLength(1);
  });

  it("skips placeholder and empty emails", () => {
    const placeholder = activated({ email: "u1@placeholder.twinmcp.fr", daysAtLimit7d: 4 });
    const empty = activated({ userId: "u2", email: "" });
    const blank = activated({ userId: "u3", email: "   " });
    expect(selectNudgeCandidates([placeholder, empty, blank], NOW)).toEqual([]);
  });

  it("skips paid accounts even when they look activated", () => {
    const pro = activated({ plan: "pro", daysAtLimit7d: 7 });
    const team = activated({ userId: "u2", plan: "team", daysAtLimit7d: 7 });
    expect(selectNudgeCandidates([pro, team], NOW)).toEqual([]);
  });

  it("ignores malformed nudge state instead of crashing", () => {
    const weird = activated({ metadata: { nudges: "oops", emailNudges: "yes" } });
    const bad = activated({
      userId: "u2",
      metadata: { nudges: { lastEmailAt: "not a date", offerAt: 42 } },
    });
    expect(selectNudgeCandidates([weird, bad], NOW).map((d) => d.kind)).toEqual(["offer", "offer"]);
  });
});

describe("selectNudgeCandidates — ordering", () => {
  it("puts never-nudged accounts first, then the oldest-nudged", () => {
    const nudged20 = activated({
      userId: "n20",
      metadata: { nudges: { lastEmailAt: daysAgo(20).toISOString() } },
    });
    const never = activated({ userId: "never" });
    const nudged40 = activated({
      userId: "n40",
      metadata: { nudges: { lastEmailAt: daysAgo(40).toISOString() } },
    });
    const out = selectNudgeCandidates([nudged20, never, nudged40], NOW);
    expect(out.map((d) => d.userId)).toEqual(["never", "n40", "n20"]);
  });
});

const HOUR = 3_600_000;

/** A fresh sign-up that never reached a tool call: 30 h old, nothing set up. */
function fresh(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    userId: "f1",
    email: "new@example.com",
    plan: "free",
    createdAt: new Date(NOW.getTime() - 30 * HOUR),
    stripeCustomerId: null,
    metadata: {},
    serverCount: 0,
    mcpCount: 0,
    requests7d: 0,
    daysAtLimit7d: 0,
    ...over,
  };
}

describe("selectNudgeCandidates — the activation reminder", () => {
  it("reminds a 24 h old account with no first tool call", () => {
    const [d] = selectNudgeCandidates([fresh()], NOW);
    expect(d).toMatchObject({
      userId: "f1",
      email: "new@example.com",
      kind: "activation",
      reason: "activation",
    });
  });

  it("waits the full 24 hours after sign-up", () => {
    const early = fresh({
      createdAt: new Date(NOW.getTime() - (ACTIVATION_EMAIL_DELAY_HOURS * HOUR - 60_000)),
    });
    expect(selectNudgeCandidates([early], NOW)).toEqual([]);
    const onTime = fresh({
      createdAt: new Date(NOW.getTime() - ACTIVATION_EMAIL_DELAY_HOURS * HOUR),
    });
    expect(selectNudgeCandidates([onTime], NOW)).toHaveLength(1);
  });

  it("never reminds accounts older than the first week", () => {
    const old = fresh({ createdAt: daysAgo(ACTIVATION_EMAIL_MAX_AGE_DAYS) });
    expect(selectNudgeCandidates([old], NOW)).toEqual([]);
  });

  it("skips an account whose first tool call is stamped", () => {
    const done = fresh({ metadata: { firstToolCallAt: daysAgo(0.5).toISOString() } });
    expect(selectNudgeCandidates([done], NOW)).toEqual([]);
  });

  it("skips an account with recorded requests (a client is connected)", () => {
    expect(selectNudgeCandidates([fresh({ requests7d: 3 })], NOW)).toEqual([]);
  });

  it("is sent once, ever (deduped on nudges.activationAt)", () => {
    const sent = fresh({
      createdAt: daysAgo(6),
      metadata: { nudges: stampedNudgeState({}, "activation", daysAgo(5)) },
    });
    // Out of the 7-day cooldown on purpose: the stamp alone must block it.
    const stale = fresh({
      userId: "f2",
      createdAt: daysAgo(6.5),
      metadata: { nudges: { activationAt: daysAgo(6).toISOString() } },
    });
    expect(selectNudgeCandidates([sent, stale], NOW)).toEqual([]);
  });

  it("respects emailNudges === false, placeholder emails and the shared cooldown", () => {
    const optedOut = fresh({ metadata: { emailNudges: false } });
    const placeholder = fresh({ userId: "f2", email: "f2@placeholder.twinmcp.fr" });
    const cooling = fresh({
      userId: "f3",
      metadata: { nudges: { lastEmailAt: new Date(NOW.getTime() - 2 * HOUR).toISOString() } },
    });
    expect(selectNudgeCandidates([optedOut, placeholder, cooling], NOW)).toEqual([]);
  });

  it("also reminds a Pro trial that never connected", () => {
    const trial = fresh({ plan: "pro", stripeCustomerId: "cus_1" });
    expect(selectNudgeCandidates([trial], NOW).map((d) => d.kind)).toEqual(["activation"]);
  });

  it("counts a server and an MCP as not yet activated without a tool call", () => {
    const halfway = fresh({ serverCount: 1, mcpCount: 1 });
    expect(selectNudgeCandidates([halfway], NOW).map((d) => d.kind)).toEqual(["activation"]);
  });

  it("never overlaps the upgrade nudges (they need real usage)", () => {
    const quota = activated({ createdAt: daysAgo(2), daysAtLimit7d: 2 });
    expect(selectNudgeCandidates([quota], NOW).map((d) => d.kind)).toEqual(["quota_limit"]);
  });
});

describe("nudge-state — activation helpers", () => {
  it("stamps activationAt and lastEmailAt, keeping the other kinds", () => {
    const prior = { nudges: { offerAt: "2026-01-01T00:00:00.000Z", lastEmailAt: "x" } };
    expect(stampedNudgeState(prior, "activation", NOW)).toEqual({
      offerAt: "2026-01-01T00:00:00.000Z",
      lastEmailAt: NOW.toISOString(),
      activationAt: NOW.toISOString(),
    });
    expect(stampedNudgeState({}, "quota_limit", NOW)).toEqual({
      lastEmailAt: NOW.toISOString(),
      quotaLimitAt: NOW.toISOString(),
    });
  });

  it("reads firstToolCallAt, tolerating absent or malformed values", () => {
    expect(firstToolCallAt({ firstToolCallAt: NOW.toISOString() })).toEqual(NOW);
    expect(firstToolCallAt({ firstToolCallAt: "nope" })).toBeNull();
    expect(firstToolCallAt({})).toBeNull();
    expect(firstToolCallAt(null)).toBeNull();
  });
});
