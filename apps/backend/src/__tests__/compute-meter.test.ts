import { describe, expect, it } from "vitest";
import { loadPricing, priceComputeMicros, type Pricing } from "@/lib/wallet/pricing";
import {
  CPU_NS_PER_HOUR,
  MIN_WARNING_LEAD_MS,
  NOTIFIED_KEYS,
  WALLCLOCK_MAX_WINDOW_MS,
  awakeSecondsSince,
  decideEnforcement,
  decideMeter,
  effectiveTotalMicros,
  isFunded,
  killSwitchActive,
  stageDays,
  type EnforceInput,
  type UsageSnapshot,
} from "@/lib/wallet/compute-meter";
import { epochToDate, toBoxUsage } from "@/lib/upstash/box-client";

// Compute metering and wallet enforcement are money logic: every decision is a
// pure function, tested here against a fixed price list (×10, 0.92 EUR/USD).

const P: Pricing = { ...loadPricing(), multiplier: 10, usdToEur: 0.92 };
const HOUR = 3_600_000;
const DAY = 86_400_000;
const T0 = new Date("2026-11-01T10:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

const snap = (totalCostUsd: number, totalCpuNs = 0, sampledAt = T0): UsageSnapshot => ({
  totalCostUsd,
  totalCpuNs,
  sampledAt,
});
const usage = (
  u: Partial<{
    totalCpuNs: number | null;
    totalComputeCostUsd: number | null;
    lastActivityAt: Date | null;
    status: string;
  }> = {}
) => ({
  totalCpuNs: null,
  totalComputeCostUsd: null,
  lastActivityAt: null,
  status: "running",
  ...u,
});

describe("decideMeter — cost counter", () => {
  it("first sight of a box (no snapshot) records a baseline and bills nothing", () => {
    const d = decideMeter({
      snapshot: null,
      usage: usage({ totalComputeCostUsd: 3.21, totalCpuNs: 5e12 }),
      size: "small",
      now: T0,
      pricing: P,
    });
    expect(d.source).toBe("baseline");
    expect(d.amountMicros).toBe(0);
    expect(d.next).toEqual({ totalCostUsd: 3.21, totalCpuNs: 5e12 });
  });

  it("bills the counter increase at cost × usdToEur × multiplier", () => {
    const d = decideMeter({
      snapshot: snap(0.01),
      usage: usage({ totalComputeCostUsd: 0.015 }),
      size: "small",
      now: at(5 * 60_000),
      pricing: P,
    });
    expect(d.source).toBe("cost");
    expect(d.deltaUsd).toBe(0.005);
    // 0.015 × 9.2 € = 0.138 € ; 0.01 × 9.2 € = 0.092 €
    expect(d.amountMicros).toBe(138_000 - 92_000);
    expect(d.next.totalCostUsd).toBe(0.015);
    expect(d.estimated).toBe(false);
  });

  it("a counter below the snapshot bills nothing and never lowers the snapshot", () => {
    const d = decideMeter({
      snapshot: snap(0.5),
      usage: usage({ totalComputeCostUsd: 0.2 }),
      size: "small",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.amountMicros).toBe(0);
    expect(d.deltaUsd).toBe(0);
    expect(d.next.totalCostUsd).toBe(0.5);
  });

  it("prices cumulative totals, so many tiny samples add up exactly to one big one", () => {
    let s = snap(0);
    let billed = 0;
    for (let i = 1; i <= 1000; i++) {
      const d = decideMeter({
        snapshot: s,
        usage: usage({ totalComputeCostUsd: i * 0.0000013 }),
        size: "small",
        now: at(i * 1000),
        pricing: P,
      });
      billed += d.amountMicros;
      s = snap(d.next.totalCostUsd, 0, at(i * 1000));
    }
    expect(billed).toBe(priceComputeMicros(s.totalCostUsd, P));
    expect(s.totalCostUsd).toBeCloseTo(0.0013, 6);
  });
});

describe("decideMeter — CPU counter fallback", () => {
  it("prices CPU time at the Upstash list rate for the box size", () => {
    const d = decideMeter({
      snapshot: snap(0, 1e12),
      usage: usage({ totalCpuNs: 1e12 + CPU_NS_PER_HOUR }),
      size: "small",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.source).toBe("cpu");
    expect(d.deltaUsd).toBe(0.1);
    expect(d.amountMicros).toBe(920_000);
    expect(d.next.totalCpuNs).toBe(1e12 + CPU_NS_PER_HOUR);
    expect(d.cpuNsDelta).toBe(CPU_NS_PER_HOUR);
  });

  it("CPU time alone is billed at the per-core (small) rate for every size, never above it", () => {
    // Pins the assumption: Upstash's medium/large CPU-hour unit (per core or
    // per box) is unconfirmed, so CPU time never bills at the larger rates.
    const d = decideMeter({
      snapshot: snap(0, 0),
      usage: usage({ totalCpuNs: CPU_NS_PER_HOUR }),
      size: "large",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.deltaUsd).toBe(0.1);
  });

  it("the cost counter wins over the CPU counter when both are present", () => {
    const d = decideMeter({
      snapshot: snap(0, 0),
      usage: usage({ totalCpuNs: CPU_NS_PER_HOUR, totalComputeCostUsd: 0.05 }),
      size: "small",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.source).toBe("cost");
    expect(d.deltaUsd).toBe(0.05);
    expect(d.next.totalCpuNs).toBe(CPU_NS_PER_HOUR);
  });
});

describe("decideMeter — wall-clock fallback (no counters)", () => {
  it("bills an awake box for the whole window, flagged as estimated", () => {
    const d = decideMeter({
      snapshot: snap(0),
      usage: usage({ status: "running" }),
      size: "small",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.source).toBe("wallclock");
    expect(d.estimated).toBe(true);
    expect(d.awakeSeconds).toBe(3600);
    expect(d.deltaUsd).toBe(0.01);
    expect(d.amountMicros).toBe(92_000);
    expect(d.next.totalCostUsd).toBe(0.01);
  });

  it("a paused box is billed only up to its last activity", () => {
    expect(awakeSecondsSince(T0, at(HOUR), "paused", at(HOUR / 2))).toBe(1800);
  });

  it("a paused box with no activity since the last sample costs nothing", () => {
    const d = decideMeter({
      snapshot: snap(0.2),
      usage: usage({ status: "paused", lastActivityAt: at(-HOUR) }),
      size: "medium",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.amountMicros).toBe(0);
    expect(d.next.totalCostUsd).toBe(0.2);
  });

  it("caps one sample at the 6 h window after a meter outage", () => {
    expect(awakeSecondsSince(T0, at(48 * HOUR), "running", null)).toBe(
      WALLCLOCK_MAX_WINDOW_MS / 1000
    );
  });

  it("a counter that reappears later is billed only above what was estimated", () => {
    // 0.01 USD estimated, then Upstash reports 0.012 in total.
    const d = decideMeter({
      snapshot: snap(0.01),
      usage: usage({ totalComputeCostUsd: 0.012 }),
      size: "small",
      now: at(HOUR),
      pricing: P,
    });
    expect(d.deltaUsd).toBe(0.002);
  });
});

describe("box usage mapping", () => {
  it("infers the epoch unit from the magnitude", () => {
    const ms = Date.parse("2026-10-29T12:00:00.000Z");
    expect(epochToDate(ms / 1000)?.getTime()).toBe(ms);
    expect(epochToDate(ms)?.getTime()).toBe(ms);
    expect(epochToDate(ms * 1000)?.getTime()).toBe(ms);
    expect(epochToDate(ms * 1e6)?.getTime()).toBe(ms);
    expect(epochToDate(undefined)).toBeNull();
    expect(epochToDate(0)).toBeNull();
    expect(epochToDate(Number.NaN)).toBeNull();
  });

  it("keeps absent counters as null (not 0) so the meter can fall back", () => {
    const u = toBoxUsage({ id: "b1", status: "running", size: "small", created_at: 1_700_000_000 });
    expect(u.totalComputeCostUsd).toBeNull();
    expect(u.totalCpuNs).toBeNull();
    expect(u.lastActivityAt).toBeNull();
    expect(u.size).toBe("small");
    const v = toBoxUsage({
      id: "b2",
      status: "idle",
      size: "huge",
      total_compute_cost_usd: 0.42,
      total_cpu_ns: 12,
      last_activity_at: 1_700_000_000_000,
    });
    expect(v.totalComputeCostUsd).toBe(0.42);
    expect(v.totalCpuNs).toBe(12);
    expect(v.size).toBeNull();
    expect(v.lastActivityAt?.getTime()).toBe(1_700_000_000_000);
  });

  it("rejects negative or non-numeric counters", () => {
    const u = toBoxUsage({
      id: "b3",
      total_compute_cost_usd: -1,
      total_cpu_ns: Number.POSITIVE_INFINITY,
    });
    expect(u.totalComputeCostUsd).toBeNull();
    expect(u.totalCpuNs).toBeNull();
    expect(u.status).toBe("unknown");
  });
});

describe("wallet helpers", () => {
  it("counts promo credit only while unexpired", () => {
    const w = { paidMicros: 1_000_000, promoMicros: 5_000_000, promoExpiresAt: at(DAY) };
    expect(effectiveTotalMicros(w, T0)).toBe(6_000_000);
    expect(effectiveTotalMicros(w, at(2 * DAY))).toBe(1_000_000);
    expect(effectiveTotalMicros({ ...w, promoExpiresAt: null }, at(99 * DAY))).toBe(6_000_000);
    expect(effectiveTotalMicros(null, T0)).toBe(0);
  });

  it("is funded with a first top-up or a subscription still being paid, never by plan", () => {
    expect(isFunded(null)).toBe(false);
    expect(isFunded(null, null)).toBe(false);
    expect(isFunded(T0)).toBe(true);
    expect(isFunded(T0, "canceled")).toBe(true);
    expect(isFunded(null, "active")).toBe(true);
    expect(isFunded(null, "past_due")).toBe(true);
    // A trial never paid: a trialing (or trial-then-converted) account stays
    // promo-only even though users.plan may still read 'pro'.
    expect(isFunded(null, "trialing")).toBe(false);
    expect(isFunded(null, "canceled")).toBe(false);
  });

  it("a daily kill switch lifts the next UTC day; a total one only when funded", () => {
    const daily = { reason: "daily", at: T0.toISOString(), day: "2026-11-01", costEur: 1.2 };
    expect(killSwitchActive(daily, T0, false)).toBe(true);
    expect(killSwitchActive(daily, at(DAY), false)).toBe(false);
    expect(killSwitchActive(daily, T0, true)).toBe(false);
    const total = { ...daily, reason: "total" };
    expect(killSwitchActive(total, at(30 * DAY), false)).toBe(true);
    expect(killSwitchActive(total, T0, true)).toBe(false);
    expect(killSwitchActive(undefined, T0, false)).toBe(false);
  });
});

function input(over: Partial<EnforceInput> = {}): EnforceInput {
  return {
    now: T0,
    totalMicros: 5_000_000,
    funded: false,
    promoExpiresAt: at(10 * DAY),
    zeroBalanceAt: null,
    notified: {},
    activeServerIds: ["s1"],
    runtimeServerIds: ["s1", "s2"],
    computeCostTodayUsd: 0,
    computeCostTotalUsd: 0,
    pricing: P,
    ...over,
  };
}

// A promo-only account whose promo expired and whose balance is empty,
// `days` after the countdown started at T0.
function expired(days: number, over: Partial<EnforceInput> = {}): EnforceInput {
  return input({
    now: at(days * DAY + HOUR),
    totalMicros: 0,
    promoExpiresAt: at(-DAY),
    zeroBalanceAt: T0,
    ...over,
  });
}
const cycle = T0.toISOString();
const stamp = (ms: number, c = cycle) => ({ at: at(ms).toISOString(), cycle: c });

describe("decideEnforcement — pausing", () => {
  it("does nothing with credit left", () => {
    const d = decideEnforcement(input());
    expect(d.pauseServerIds).toEqual([]);
    expect(d.pauseReason).toBeNull();
    expect(d.warning).toBeNull();
    expect(d.deleteRuntimeServerIds).toEqual([]);
    expect(d.zeroBalanceAt).toBeUndefined();
  });

  it("clears the zero-balance timer once the balance is positive again", () => {
    expect(decideEnforcement(input({ zeroBalanceAt: at(-DAY) })).zeroBalanceAt).toBeNull();
  });

  it("pauses running boxes at zero and starts the timer", () => {
    const d = decideEnforcement(input({ totalMicros: 0 }));
    expect(d.pauseServerIds).toEqual(["s1"]);
    expect(d.pauseReason).toBe("no_credit");
    expect(d.zeroBalanceAt).toEqual(T0);
  });

  it("pauses below zero too (usage that already happened)", () => {
    const d = decideEnforcement(input({ totalMicros: -600_000, funded: true }));
    expect(d.pauseServerIds).toEqual(["s1"]);
  });

  it("a live paying legacy subscription is not paused for an empty wallet", () => {
    // Not yet converted by the owner's script: the period is paid.
    const d = decideEnforcement(input({ totalMicros: 0, payingSubscription: true }));
    expect(d.pauseServerIds).toEqual([]);
    expect(d.pauseReason).toBeNull();
  });

  it("no running box: nothing to pause", () => {
    const d = decideEnforcement(input({ totalMicros: 0, activeServerIds: [] }));
    expect(d.pauseServerIds).toEqual([]);
    expect(d.pauseReason).toBeNull();
  });
});

describe("decideEnforcement — funded accounts are never deleted", () => {
  it("a funded account at zero for 60 days is paused, never warned or deleted", () => {
    const d = decideEnforcement(
      expired(60, {
        funded: true,
        notified: { [NOTIFIED_KEYS.deletionWarning("day13")]: stamp(13 * DAY) },
      })
    );
    expect(d.pauseServerIds).toEqual(["s1"]);
    expect(d.warning).toBeNull();
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });
});

describe("decideEnforcement — promo-only deletion countdown", () => {
  it("no countdown while the promo is still valid (only used up)", () => {
    const d = decideEnforcement(input({ totalMicros: 0, promoExpiresAt: at(5 * DAY) }));
    expect(d.warning).toBeNull();
    expect(d.cycle).toBeNull();
  });

  it("day 0: first warning, deletion date 14 days out", () => {
    const d = decideEnforcement(expired(0));
    expect(d.warning).toBe("day0");
    expect(d.cycle).toBe(cycle);
    expect(d.deleteAt).toEqual(at(14 * DAY));
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });

  it("the countdown starts at promo expiry when the balance hit zero earlier", () => {
    const d = decideEnforcement(
      input({ now: at(HOUR), totalMicros: 0, zeroBalanceAt: at(-5 * DAY), promoExpiresAt: T0 })
    );
    expect(d.cycle).toBe(cycle);
    expect(d.warning).toBe("day0");
  });

  it("day 3 with day 0 sent: nothing new", () => {
    const d = decideEnforcement(
      expired(3, { notified: { [NOTIFIED_KEYS.deletionWarning("day0")]: stamp(0) } })
    );
    expect(d.warning).toBeNull();
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });

  it("day 7: second warning", () => {
    const d = decideEnforcement(
      expired(7, { notified: { [NOTIFIED_KEYS.deletionWarning("day0")]: stamp(0) } })
    );
    expect(d.warning).toBe("day7");
  });

  it("after a cron outage only the latest due warning goes out", () => {
    expect(decideEnforcement(expired(9)).warning).toBe("day7");
    expect(decideEnforcement(expired(13)).warning).toBe("day13");
  });

  it("day 14 with the day-13 warning a day old: runtimes deleted", () => {
    const d = decideEnforcement(
      expired(14, {
        notified: { [NOTIFIED_KEYS.deletionWarning("day13")]: stamp(13 * DAY) },
      })
    );
    expect(d.warning).toBeNull();
    expect(d.deleteRuntimeServerIds).toEqual(["s1", "s2"]);
  });

  it("day 14 but the last warning went out under 20 h ago: wait", () => {
    const now = 14 * DAY + HOUR;
    const d = decideEnforcement(
      expired(14, {
        notified: {
          [NOTIFIED_KEYS.deletionWarning("day13")]: stamp(now - MIN_WARNING_LEAD_MS + HOUR),
        },
      })
    );
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });

  it("day 20 and no day-13 warning ever sent: warn first, never delete unwarned", () => {
    const d = decideEnforcement(
      expired(20, { notified: { [NOTIFIED_KEYS.deletionWarning("day7")]: stamp(7 * DAY) } })
    );
    expect(d.warning).toBe("day13");
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });

  it("stamps from an earlier zero-balance cycle do not count", () => {
    const old = at(-60 * DAY).toISOString();
    const d = decideEnforcement(
      expired(14, {
        notified: { [NOTIFIED_KEYS.deletionWarning("day13")]: stamp(-47 * DAY, old) },
      })
    );
    expect(d.warning).toBe("day13");
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });

  it("once deleted this cycle, nothing more happens", () => {
    const d = decideEnforcement(
      expired(20, {
        notified: {
          [NOTIFIED_KEYS.deletionWarning("day13")]: stamp(13 * DAY),
          [NOTIFIED_KEYS.runtimeDeleted]: stamp(14 * DAY),
        },
      })
    );
    expect(d.warning).toBeNull();
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });

  it("no runtime left: no countdown", () => {
    const d = decideEnforcement(expired(14, { runtimeServerIds: [], activeServerIds: [] }));
    expect(d.warning).toBeNull();
    expect(d.deleteRuntimeServerIds).toEqual([]);
  });
});

describe("decideEnforcement — promo kill switch", () => {
  it("promo-only real cost over €0.20 today: pause and raise a daily flag", () => {
    // 0.25 USD × 0.92 = 0.23 € > 0.20 €
    const d = decideEnforcement(input({ computeCostTodayUsd: 0.25, computeCostTotalUsd: 0.25 }));
    expect(d.newKillSwitch).toMatchObject({ reason: "daily", day: "2026-11-01" });
    expect(d.pauseServerIds).toEqual(["s1"]);
    expect(d.pauseReason).toBe("promo_daily_cap");
  });

  it("under the caps: nothing", () => {
    const d = decideEnforcement(input({ computeCostTodayUsd: 0.2, computeCostTotalUsd: 0.9 }));
    expect(d.newKillSwitch).toBeNull();
    expect(d.pauseServerIds).toEqual([]);
  });

  it("total real cost over €0.90: total flag, even on a quiet day", () => {
    const d = decideEnforcement(input({ computeCostTodayUsd: 0, computeCostTotalUsd: 1.0 }));
    expect(d.newKillSwitch?.reason).toBe("total");
    expect(d.pauseReason).toBe("promo_total_cap");
  });

  it("an active daily flag keeps pausing without raising a new one", () => {
    const flag = { reason: "daily", at: T0.toISOString(), day: "2026-11-01", costEur: 1.1 };
    const d = decideEnforcement(
      input({
        now: at(HOUR),
        computeCostTodayUsd: 0.3,
        notified: { [NOTIFIED_KEYS.killSwitch]: flag },
      })
    );
    expect(d.newKillSwitch).toBeNull();
    expect(d.pauseServerIds).toEqual(["s1"]);
  });

  it("a daily flag escalates to total when the total cap is passed", () => {
    const flag = { reason: "daily", at: T0.toISOString(), day: "2026-11-01", costEur: 1.1 };
    const d = decideEnforcement(
      input({
        computeCostTodayUsd: 0.3,
        computeCostTotalUsd: 1.2,
        notified: { [NOTIFIED_KEYS.killSwitch]: flag },
      })
    );
    expect(d.newKillSwitch?.reason).toBe("total");
  });

  it("trips while the promo balance is still positive (caps sit below the promo's real cost)", () => {
    // €10 promo at ×10 is worth €1 of real cost. Burn €0.95 of real cost
    // (€9.50 billed): €0.50 of credit left, and the total cap already tripped.
    const billed = priceComputeMicros(0.95 / 0.92, P);
    const d = decideEnforcement(
      input({
        totalMicros: 10_000_000 - billed,
        computeCostTodayUsd: 0,
        computeCostTotalUsd: 0.95 / 0.92,
      })
    );
    expect(10_000_000 - billed).toBeGreaterThan(0);
    expect(d.newKillSwitch?.reason).toBe("total");
    expect(d.pauseServerIds).toEqual(["s1"]);
  });

  it("never applies to a funded account", () => {
    const d = decideEnforcement(
      input({ funded: true, computeCostTodayUsd: 50, computeCostTotalUsd: 500 })
    );
    expect(d.newKillSwitch).toBeNull();
    expect(d.pauseServerIds).toEqual([]);
  });
});

describe("stageDays", () => {
  it("maps each warning stage to the day number lib/wallet/notify.ts keys on", () => {
    expect(stageDays("day0")).toBe(0);
    expect(stageDays("day7")).toBe(7);
    expect(stageDays("day13")).toBe(13);
  });
});
