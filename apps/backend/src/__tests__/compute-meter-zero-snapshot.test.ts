import { beforeEach, describe, expect, it, vi } from "vitest";

// A box with no snapshot used to be a free baseline on its first sample.
// Provisioning writes a zero snapshot at creation (ensureZeroSnapshot), and a
// snapshot-less box created after metering started is billed from zero; only
// boxes older than metering (pre-0020) keep the baseline behaviour.

const mocks = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  conflictTargets: [] as unknown[],
  failures: 0,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/db", () => ({
  getDb: () => ({
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoNothing: async (opts: { target: unknown }) => {
          if (mocks.failures > 0) {
            mocks.failures--;
            throw new Error("db down");
          }
          mocks.inserted.push(v);
          mocks.conflictTargets.push(opts.target);
          return [];
        },
      }),
    }),
  }),
}));

import {
  billsFromZero,
  decideMeter,
  ensureZeroSnapshot,
  meteringSince,
} from "@/lib/wallet/compute-meter";
import { loadPricing, priceComputeMicros, type Pricing } from "@/lib/wallet/pricing";

const P: Pricing = { ...loadPricing(), multiplier: 10, usdToEur: 0.92 };
const T0 = new Date("2026-11-01T10:00:00.000Z");
const HOUR = 3_600_000;

beforeEach(() => {
  mocks.inserted = [];
  mocks.conflictTargets = [];
  mocks.failures = 0;
});

describe("ensureZeroSnapshot (box creation)", () => {
  it("writes total_cost_usd 0 and total_cpu_ns 0 for the new box", async () => {
    await ensureZeroSnapshot("box_1", "srv_1", "user_1", T0, 1);
    expect(mocks.inserted).toEqual([
      {
        boxId: "box_1",
        serverId: "srv_1",
        userId: "user_1",
        totalCostUsd: "0",
        totalCpuNs: 0,
        sampledAt: T0,
      },
    ]);
    // Insert-if-absent: never resets an existing snapshot.
    expect(mocks.conflictTargets).toHaveLength(1);
  });

  it("retries a transient failure, and never throws", async () => {
    vi.useFakeTimers();
    try {
      mocks.failures = 1;
      const p = ensureZeroSnapshot("box_2", null, null, T0, 3);
      await vi.runAllTimersAsync();
      await p;
      expect(mocks.inserted).toHaveLength(1);

      mocks.failures = 5;
      const q = ensureZeroSnapshot("box_3", null, null, T0, 2);
      await vi.runAllTimersAsync();
      await expect(q).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("billsFromZero / meteringSince", () => {
  it("a box created at or after metering start is billed from zero", () => {
    expect(billsFromZero(T0, T0)).toBe(true);
    expect(billsFromZero(new Date(T0.getTime() + 1), T0)).toBe(true);
  });

  it("a box older than metering (pre-0020) is baselined", () => {
    expect(billsFromZero(new Date(T0.getTime() - 1), T0)).toBe(false);
  });

  it("an unknown creation time is baselined (never bill what may predate metering)", () => {
    expect(billsFromZero(null, T0)).toBe(false);
    expect(billsFromZero(undefined, T0)).toBe(false);
  });

  it("WALLET_METERING_SINCE overrides the process start; junk falls back", () => {
    const started = new Date("2026-11-02T00:00:00.000Z");
    expect(meteringSince({ WALLET_METERING_SINCE: "2026-10-31T08:00:00Z" }, started)).toEqual(
      new Date("2026-10-31T08:00:00Z")
    );
    expect(meteringSince({ WALLET_METERING_SINCE: "not a date" }, started)).toBe(started);
    expect(meteringSince({}, started)).toBe(started);
    expect(meteringSince({ WALLET_METERING_SINCE: "  " }, started)).toBe(started);
  });
});

describe("decideMeter without a snapshot", () => {
  const usage = {
    totalCpuNs: null,
    totalComputeCostUsd: 0.05,
    lastActivityAt: null,
    status: "running",
    createdAt: new Date(T0.getTime() - HOUR),
  };

  it("baseline (pre-metering box): records the counters, bills nothing", () => {
    const d = decideMeter({ snapshot: null, usage, size: "small", now: T0, pricing: P });
    expect(d.source).toBe("baseline");
    expect(d.amountMicros).toBe(0);
    expect(d.next.totalCostUsd).toBe(0.05);
  });

  it("billFromZero: the whole counter is billed, exactly as from a zero snapshot", () => {
    const d = decideMeter({
      snapshot: null,
      usage,
      size: "small",
      now: T0,
      billFromZero: true,
      pricing: P,
    });
    expect(d.source).toBe("cost");
    expect(d.amountMicros).toBe(priceComputeMicros(0.05, P));
    expect(d.next.totalCostUsd).toBe(0.05);

    const fromZero = decideMeter({
      snapshot: { totalCostUsd: 0, totalCpuNs: 0, sampledAt: usage.createdAt },
      usage,
      size: "small",
      now: T0,
      pricing: P,
    });
    expect(d.amountMicros).toBe(fromZero.amountMicros);
  });

  it("billFromZero with only the wall clock bills from the box's creation", () => {
    const d = decideMeter({
      snapshot: null,
      usage: { ...usage, totalComputeCostUsd: null },
      size: "small",
      now: T0,
      billFromZero: true,
      pricing: P,
    });
    expect(d.source).toBe("wallclock");
    expect(d.awakeSeconds).toBe(3600);
    expect(d.amountMicros).toBeGreaterThan(0);
  });
});
