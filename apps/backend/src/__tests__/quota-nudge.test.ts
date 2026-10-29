import { describe, it, expect, beforeEach, vi } from "vitest";

// notifyQuotaLimit runs fire-and-forget from the MCP proxy's 429 path. These
// tests pin its guarantees: one email per user per day (Redis claim FIRST),
// Free accounts only, opt-out honoured, and no throw whatever fails.

const mocks = vi.hoisted(() => ({
  redisSet: vi.fn<(...args: unknown[]) => Promise<"OK" | null>>(),
  dbLimit: vi.fn<() => Promise<unknown[]>>(),
  dbUpdateSet: vi.fn<(values: unknown) => void>(),
  dbUpdateWhere: vi.fn<() => Promise<unknown>>(),
  sendQuotaLimitEmail: vi.fn<(...args: unknown[]) => Promise<void>>(),
  trackServer: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({ getRedis: () => ({ set: mocks.redisSet }) }));

vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.dbLimit }) }) }),
    update: () => ({
      set: (values: unknown) => {
        mocks.dbUpdateSet(values);
        return { where: mocks.dbUpdateWhere };
      },
    }),
  }),
}));

vi.mock("@/lib/email", () => ({ sendQuotaLimitEmail: mocks.sendQuotaLimitEmail }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: mocks.trackServer }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import {
  notifyQuotaLimit,
  emailNudgesEnabled,
  resetQuotaNudgeClaims,
} from "@/lib/billing/quota-nudge";
import { NUDGE_COOLDOWN_DAYS } from "@/lib/billing/nudge-state";
import { PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";

const USER = "user_free_1";
const RL = { limit: 50, reset: Date.now() + 3_600_000 };
const DAY_MS = 86_400_000;

/**
 * The `nudges` object the stamp merges into users.metadata: the jsonb param of
 * the drizzle `sql` template (a bare string chunk until the query is built).
 */
function stampedNudges(): { lastEmailAt: string; offerAt?: string; quotaLimitAt?: string } {
  const [values] = mocks.dbUpdateSet.mock.calls[0] as [{ metadata: { queryChunks: unknown[] } }];
  const json = values.metadata.queryChunks
    .map((c) =>
      typeof c === "string"
        ? c
        : c && typeof c === "object" && "value" in c
          ? (c as { value: unknown }).value
          : null
    )
    .find((v): v is string => typeof v === "string" && v.includes('"nudges"'));
  expect(json).toBeDefined();
  return (JSON.parse(json as string) as { nudges: ReturnType<typeof stampedNudges> }).nudges;
}

function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    email: "dev@example.com",
    metadata: {},
    stripeCustomerId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetQuotaNudgeClaims();
  mocks.redisSet.mockResolvedValue("OK");
  mocks.dbLimit.mockResolvedValue([userRow()]);
  mocks.dbUpdateWhere.mockResolvedValue(undefined);
  mocks.sendQuotaLimitEmail.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("notifyQuotaLimit", () => {
  it("sends the quota-limit email once and tracks it", async () => {
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.redisSet).toHaveBeenCalledTimes(1);
    const [key, value, opts] = mocks.redisSet.mock.calls[0] as [string, unknown, unknown];
    expect(key).toMatch(new RegExp(`^nudge:quota-email:${USER}:\\d+$`));
    expect(value).toBe(1);
    expect(opts).toEqual({ nx: true, ex: 86_400 });

    expect(mocks.sendQuotaLimitEmail).toHaveBeenCalledTimes(1);
    const [to, payload] = mocks.sendQuotaLimitEmail.mock.calls[0] as [
      string,
      {
        used: number;
        limit: number;
        resetsAt: Date;
        trialDays: number;
        proDailyLimit: number;
      },
    ];
    expect(to).toBe("dev@example.com");
    expect(payload.used).toBe(50);
    expect(payload.limit).toBe(50);
    expect(payload.resetsAt.getTime()).toBe(RL.reset);
    expect(payload.trialDays).toBe(PRO_TRIAL_DAYS);
    expect(payload.proDailyLimit).toBe(getDailyLimit("pro"));

    expect(mocks.trackServer).toHaveBeenCalledWith({
      event: "upgrade_email_sent",
      distinctId: USER,
      properties: { kind: "quota_limit", reason: "quota_limit" },
    });
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("skips the second call the same day (per-process memory, then the Redis claim)", async () => {
    await notifyQuotaLimit(USER, "free", RL);
    await notifyQuotaLimit(USER, "free", RL);
    // The second rejected request never reaches Redis.
    expect(mocks.redisSet).toHaveBeenCalledTimes(1);

    // Another process: Redis holds today's claim.
    resetQuotaNudgeClaims();
    mocks.redisSet.mockResolvedValueOnce(null);
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.redisSet).toHaveBeenCalledTimes(2);
    expect(mocks.dbLimit).toHaveBeenCalledTimes(1);
    expect(mocks.sendQuotaLimitEmail).toHaveBeenCalledTimes(1);
    expect(mocks.trackServer).toHaveBeenCalledTimes(1);
  });

  it("stamps users.metadata.nudges after sending", async () => {
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.dbUpdateWhere).toHaveBeenCalledTimes(1);
    const nudges = stampedNudges();
    expect(new Date(nudges.lastEmailAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(nudges.quotaLimitAt).toBe(nudges.lastEmailAt);
  });

  it(`skips within the ${NUDGE_COOLDOWN_DAYS}-day cooldown shared with the daily job`, async () => {
    const lastEmailAt = new Date(Date.now() - (NUDGE_COOLDOWN_DAYS - 1) * DAY_MS).toISOString();
    mocks.dbLimit.mockResolvedValueOnce([userRow({ metadata: { nudges: { lastEmailAt } } })]);
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.sendQuotaLimitEmail).not.toHaveBeenCalled();
    expect(mocks.dbUpdateWhere).not.toHaveBeenCalled();
    expect(mocks.trackServer).not.toHaveBeenCalled();
  });

  it("sends again once the cooldown has passed and keeps the other nudge keys", async () => {
    const lastEmailAt = new Date(Date.now() - (NUDGE_COOLDOWN_DAYS + 1) * DAY_MS).toISOString();
    mocks.dbLimit.mockResolvedValueOnce([
      userRow({ metadata: { emailNudges: true, nudges: { lastEmailAt, offerAt: lastEmailAt } } }),
    ]);
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.sendQuotaLimitEmail).toHaveBeenCalledTimes(1);
    const nudges = stampedNudges();
    expect(nudges.offerAt).toBe(lastEmailAt);
    expect(nudges.lastEmailAt).not.toBe(lastEmailAt);
    expect(nudges.quotaLimitAt).toBe(nudges.lastEmailAt);
  });

  it("does nothing for paid plans (no Redis, no DB, no email)", async () => {
    await notifyQuotaLimit(USER, "pro", RL);
    await notifyQuotaLimit(USER, "team", RL);

    expect(mocks.redisSet).not.toHaveBeenCalled();
    expect(mocks.dbLimit).not.toHaveBeenCalled();
    expect(mocks.sendQuotaLimitEmail).not.toHaveBeenCalled();
    expect(mocks.trackServer).not.toHaveBeenCalled();
  });

  it("skips users who opted out (metadata.emailNudges === false)", async () => {
    mocks.dbLimit.mockResolvedValueOnce([userRow({ metadata: { emailNudges: false } })]);
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.redisSet).toHaveBeenCalledTimes(1);
    expect(mocks.sendQuotaLimitEmail).not.toHaveBeenCalled();
    expect(mocks.trackServer).not.toHaveBeenCalled();
  });

  it("skips placeholder and empty emails", async () => {
    mocks.dbLimit.mockResolvedValueOnce([userRow({ email: `${USER}@placeholder.twinmcp.fr` })]);
    await notifyQuotaLimit(USER, "free", RL);
    resetQuotaNudgeClaims();
    mocks.dbLimit.mockResolvedValueOnce([userRow({ email: "" })]);
    await notifyQuotaLimit(USER, "free", RL);
    resetQuotaNudgeClaims();
    mocks.dbLimit.mockResolvedValueOnce([]);
    await notifyQuotaLimit(USER, "free", RL);

    expect(mocks.dbLimit).toHaveBeenCalledTimes(3);
    expect(mocks.sendQuotaLimitEmail).not.toHaveBeenCalled();
  });

  it("promises no free month to an account that already has a Stripe customer", async () => {
    mocks.dbLimit.mockResolvedValueOnce([userRow({ stripeCustomerId: "cus_123" })]);
    await notifyQuotaLimit(USER, "free", RL);

    const [, payload] = mocks.sendQuotaLimitEmail.mock.calls[0] as [string, { trialDays: number }];
    expect(payload.trialDays).toBe(0);
  });

  it("skips (without throwing) when Redis throws, and reports it", async () => {
    mocks.redisSet.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(notifyQuotaLimit(USER, "free", RL)).resolves.toBeUndefined();

    expect(mocks.dbLimit).not.toHaveBeenCalled();
    expect(mocks.sendQuotaLimitEmail).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { area: "upgrade-nudge", stage: "quota-email" },
    });
  });

  it("never throws when the email provider fails (RESEND_API_KEY missing)", async () => {
    mocks.sendQuotaLimitEmail.mockRejectedValueOnce(new Error("RESEND_API_KEY not set"));
    await expect(notifyQuotaLimit(USER, "free", RL)).resolves.toBeUndefined();

    expect(mocks.dbUpdateWhere).not.toHaveBeenCalled();
    expect(mocks.trackServer).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("emailNudgesEnabled", () => {
  it("treats absent metadata or an absent flag as opted in", () => {
    expect(emailNudgesEnabled(undefined)).toBe(true);
    expect(emailNudgesEnabled(null)).toBe(true);
    expect(emailNudgesEnabled({})).toBe(true);
    expect(emailNudgesEnabled({ emailNudges: true })).toBe(true);
  });

  it("only an explicit false opts out", () => {
    expect(emailNudgesEnabled({ emailNudges: false })).toBe(false);
    expect(emailNudgesEnabled({ emailNudges: "false" })).toBe(true);
  });
});
