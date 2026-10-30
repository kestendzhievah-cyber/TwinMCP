import { describe, it, expect, vi } from "vitest";

// notify's decision chain is tested through injected dependencies; the module
// itself wires the DB, Resend, PostHog and Sentry — keep those out.
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/email", () => ({}));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  decideWalletNotification,
  notifyKey,
  notifyWith,
  readStamp,
  refFor,
  staleReason,
  MONEY_CRITICAL_EVENTS,
  type NotifyContext,
  type NotifyDeps,
  type NotifyStamp,
  type WalletEvent,
} from "@/lib/wallet/notify";

const NOW = new Date("2026-10-29T08:00:00.000Z");
const DAY = 86_400_000;
const EUR = 1_000_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("decideWalletNotification", () => {
  const base = { now: NOW };

  it("sends anything the first time", () => {
    const d = decideWalletNotification({
      ...base,
      notified: {},
      event: "low_balance",
      key: "low_balance",
    });
    expect(d.send).toBe(true);
    expect(d.previous).toBeNull();
    expect(d.stamp).toEqual({ at: NOW.toISOString() });
  });

  it("sends the sign-up credit email once, ever", () => {
    const d = decideWalletNotification({
      ...base,
      notified: { signup_credit_granted: { at: ago(400 * DAY) } },
      event: "signup_credit_granted",
      key: "signup_credit_granted",
    });
    expect(d.send).toBe(false);
  });

  it("repeats a low/zero balance notice only after money came in", () => {
    const notified = { zero_balance: { at: ago(3 * DAY) } };
    const same = decideWalletNotification({
      ...base,
      notified,
      event: "zero_balance",
      key: "zero_balance",
      lastCreditAt: new Date(ago(5 * DAY)),
    });
    expect(same.send).toBe(false);
    const fresh = decideWalletNotification({
      ...base,
      notified,
      event: "zero_balance",
      key: "zero_balance",
      lastCreditAt: new Date(ago(1 * DAY)),
    });
    expect(fresh.send).toBe(true);
    expect(fresh.previous).toEqual({ at: ago(3 * DAY) });
  });

  it("dedupes promo reminders per expiry date", () => {
    const expiry = "2026-11-05T00:00:00.000Z";
    const notified = { promo_expiring_7d: { at: ago(DAY), ref: expiry } };
    expect(
      decideWalletNotification({
        ...base,
        notified,
        event: "promo_expiring_7d",
        key: "promo_expiring_7d",
        ref: expiry,
      }).send
    ).toBe(false);
    expect(
      decideWalletNotification({
        ...base,
        notified,
        event: "promo_expiring_7d",
        key: "promo_expiring_7d",
        ref: "2026-12-05T00:00:00.000Z",
      }).send
    ).toBe(true);
  });

  it("does not dedupe a ref-scoped notice that carries no ref", () => {
    const d = decideWalletNotification({
      ...base,
      notified: { topup_succeeded: { at: ago(60_000) } },
      event: "topup_succeeded",
      key: "topup_succeeded",
      ref: null,
    });
    expect(d.send).toBe(true);
  });

  it("allows one failed auto-recharge email a day", () => {
    const event: WalletEvent = "auto_recharge_failed";
    expect(
      decideWalletNotification({
        ...base,
        notified: { [event]: { at: ago(DAY - 1) } },
        event,
        key: event,
      }).send
    ).toBe(false);
    expect(
      decideWalletNotification({
        ...base,
        notified: { [event]: { at: ago(DAY) } },
        event,
        key: event,
      }).send
    ).toBe(true);
  });

  it("keys runtime deletion warnings per stage", () => {
    expect(notifyKey("runtime_deletion_warning", { stage: 7 })).toBe("runtime_deletion_warning:7");
    expect(notifyKey("runtime_deletion_warning", { stage: 99 })).toBe("runtime_deletion_warning:0");
    expect(notifyKey("low_balance")).toBe("low_balance");
  });

  it("reads old or broken stamps safely", () => {
    expect(readStamp({ k: "2026-10-01T00:00:00.000Z" }, "k")).toEqual({
      at: "2026-10-01T00:00:00.000Z",
    });
    expect(readStamp({ k: { at: "nope" } }, "k")).toBeNull();
    expect(readStamp(null, "k")).toBeNull();
    expect(readStamp([], "k")).toBeNull();
  });
});

function ctx(over: Partial<NotifyContext> = {}): NotifyContext {
  return {
    email: "dev@example.com",
    metadata: {},
    funded: false,
    paidMicros: 0,
    promoMicros: 8 * EUR,
    promoExpiresAt: new Date(NOW.getTime() + 5 * DAY),
    zeroBalanceAt: null,
    autoRechargeEnabled: false,
    notified: {},
    lastCreditAt: null,
    serverCount: 1,
    ...over,
  };
}

describe("staleReason and refFor", () => {
  it("drops a low-balance notice at zero and a zero notice once refilled", () => {
    expect(staleReason("low_balance", ctx({ promoMicros: 0 }), NOW)).not.toBeNull();
    expect(staleReason("zero_balance", ctx(), NOW)).not.toBeNull();
    expect(staleReason("zero_balance", ctx({ promoMicros: 0 }), NOW)).toBeNull();
  });

  it("drops a promo reminder once the promo is spent or expired", () => {
    expect(staleReason("promo_expiring_2d", ctx({ promoMicros: 0 }), NOW)).not.toBeNull();
    expect(
      staleReason("promo_expiring_2d", ctx({ promoExpiresAt: new Date(ago(1)) }), NOW)
    ).not.toBeNull();
    expect(staleReason("promo_expiring_2d", ctx(), NOW)).toBeNull();
  });

  it("never warns a funded account about runtime deletion", () => {
    const zero = { promoMicros: 0, zeroBalanceAt: new Date(ago(DAY)) };
    expect(staleReason("runtime_deletion_warning", ctx(zero), NOW)).toBeNull();
    expect(
      staleReason("runtime_deletion_warning", ctx({ ...zero, funded: true }), NOW)
    ).not.toBeNull();
  });

  it("uses the promo expiry, the zero episode and the Stripe ref as refs", () => {
    const c = ctx({ zeroBalanceAt: new Date("2026-10-20T00:00:00.000Z") });
    expect(refFor("promo_expiring_7d", c)).toBe(c.promoExpiresAt?.toISOString());
    expect(refFor("runtime_deletion_warning", c)).toBe("2026-10-20T00:00:00.000Z");
    expect(refFor("topup_succeeded", c, { stripeRef: "cs_test_1" })).toBe("cs_test_1");
    expect(refFor("subscription_converted", c, { subscriptionId: "sub_1" })).toBe("sub_1");
    expect(refFor("low_balance", c)).toBeNull();
  });
});

function fakeDeps(context: NotifyContext | null, over: Partial<NotifyDeps> = {}) {
  const calls = {
    claims: [] as Array<{ key: string; previous: NotifyStamp | null; stamp: NotifyStamp }>,
    releases: [] as Array<{ key: string; previous: NotifyStamp | null }>,
    delivered: [] as WalletEvent[],
    reported: 0,
  };
  const deps: NotifyDeps = {
    loadContext: async () => context,
    claim: async (_u, key, previous, stamp) => {
      calls.claims.push({ key, previous, stamp });
      return true;
    },
    release: async (_u, key, previous) => {
      calls.releases.push({ key, previous });
    },
    deliver: async (event) => {
      calls.delivered.push(event);
    },
    track: () => {},
    report: () => {
      calls.reported += 1;
    },
    hasMailer: () => true,
    ...over,
  };
  return { deps, calls };
}

describe("notifyWith", () => {
  it("claims, then sends", async () => {
    const { deps, calls } = fakeDeps(ctx({ promoMicros: 1 * EUR }));
    expect(await notifyWith(deps, "u1", "low_balance", {}, NOW)).toBe("sent");
    expect(calls.claims).toHaveLength(1);
    expect(calls.claims[0].key).toBe("low_balance");
    expect(calls.delivered).toEqual(["low_balance"]);
  });

  it("does not send twice in the same episode", async () => {
    const { deps, calls } = fakeDeps(
      ctx({ promoMicros: 1 * EUR, notified: { low_balance: { at: ago(DAY) } } })
    );
    expect(await notifyWith(deps, "u1", "low_balance", {}, NOW)).toBe("deduped");
    expect(calls.claims).toHaveLength(0);
    expect(calls.delivered).toHaveLength(0);
  });

  it("respects the email opt-out for nudges only", async () => {
    const optedOut = { metadata: { emailNudges: false } };
    const low = fakeDeps(ctx({ ...optedOut, promoMicros: 1 * EUR }));
    expect(await notifyWith(low.deps, "u1", "low_balance", {}, NOW)).toBe("opted_out");
    const zero = fakeDeps(ctx({ ...optedOut, promoMicros: 0 }));
    expect(await notifyWith(zero.deps, "u1", "zero_balance", {}, NOW)).toBe("sent");
    for (const e of [
      "zero_balance",
      "auto_recharge_failed",
      "runtime_deletion_warning",
      "subscription_converted",
    ] as const) {
      expect(MONEY_CRITICAL_EVENTS.has(e)).toBe(true);
    }
  });

  it("skips placeholder addresses and unknown users", async () => {
    const ph = fakeDeps(ctx({ email: "abc@placeholder.twinmcp.fr" }));
    expect(await notifyWith(ph.deps, "u1", "signup_credit_granted", {}, NOW)).toBe("undeliverable");
    const none = fakeDeps(null);
    expect(await notifyWith(none.deps, "u1", "signup_credit_granted", {}, NOW)).toBe("no_user");
  });

  it("does nothing without a mailer and never claims", async () => {
    const { deps, calls } = fakeDeps(ctx(), { hasMailer: () => false });
    expect(await notifyWith(deps, "u1", "signup_credit_granted", {}, NOW)).toBe("no_mailer");
    expect(calls.claims).toHaveLength(0);
  });

  it("loses the race quietly when another process claimed first", async () => {
    const { deps, calls } = fakeDeps(ctx(), { claim: async () => false });
    expect(await notifyWith(deps, "u1", "signup_credit_granted", {}, NOW)).toBe("lost_race");
    expect(calls.delivered).toHaveLength(0);
  });

  it("puts the previous stamp back when the email fails", async () => {
    const previous = { at: ago(3 * DAY) };
    const { deps, calls } = fakeDeps(
      ctx({
        promoMicros: 0,
        notified: { zero_balance: previous },
        lastCreditAt: new Date(ago(DAY)),
      }),
      {
        deliver: async () => {
          throw new Error("resend down");
        },
      }
    );
    expect(await notifyWith(deps, "u1", "zero_balance", {}, NOW)).toBe("failed");
    expect(calls.releases).toEqual([{ key: "zero_balance", previous }]);
    expect(calls.reported).toBe(1);
  });

  it("never rejects, even when loading fails", async () => {
    const { deps, calls } = fakeDeps(ctx(), {
      loadContext: async () => {
        throw new Error("db down");
      },
    });
    await expect(notifyWith(deps, "u1", "low_balance", {}, NOW)).resolves.toBe("failed");
    expect(calls.reported).toBe(1);
  });

  it("sends one receipt per Stripe payment", async () => {
    const notified = { topup_succeeded: { at: ago(60_000), ref: "cs_test_1" } };
    const again = fakeDeps(ctx({ notified }));
    expect(
      await notifyWith(again.deps, "u1", "topup_succeeded", { stripeRef: "cs_test_1" }, NOW)
    ).toBe("deduped");
    const next = fakeDeps(ctx({ notified }));
    expect(
      await notifyWith(next.deps, "u1", "topup_succeeded", { stripeRef: "cs_test_2" }, NOW)
    ).toBe("sent");
  });
});
