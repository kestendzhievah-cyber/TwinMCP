import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The tool-call accumulator (contract W2): calls are batched per user and
// debited with an idempotency key minted once per batch; a failed debit is
// retried with the SAME key and amount, so a lost answer never double-charges.

const mocks = vi.hoisted(() => ({
  hasCredit: vi.fn<(userId: string) => Promise<boolean>>(),
  debit: vi.fn(),
  afterBalanceChange: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/wallet/ledger", () => ({ hasCredit: mocks.hasCredit, debit: mocks.debit }));
vi.mock("@/lib/wallet/after-debit", () => ({ afterBalanceChange: mocks.afterBalanceChange }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import {
  CALL_FLUSH_INTERVAL_MS,
  CALL_FLUSH_MAX_CALLS,
  CALL_METER_PROCESS_ID,
  CALLS_PER_MINUTE,
  TOOL_CALL_DEBIT_KIND,
  createBurstLimiter,
  createCallMeter,
  walletAllowsCall,
  type CallDebitArgs,
  type CallDebitResult,
  type CallMeterDeps,
} from "@/lib/wallet/call-meter";
import { priceToolCallsMicros } from "@/lib/wallet/pricing";

const OK: CallDebitResult = {
  applied: true,
  totalMicros: 9_000_000,
  crossedZero: false,
  crossedThreshold: false,
};

/** 100 micro-euros per call: easy arithmetic, independent of env pricing. */
const price = (calls: number) => calls * 100;

function setup(overrides: Partial<CallMeterDeps> = {}) {
  const debit = vi.fn<(args: CallDebitArgs) => Promise<CallDebitResult>>(async () => OK);
  const after = vi.fn();
  const onError = vi.fn();
  const meter = createCallMeter({
    debit,
    priceToolCallsMicros: price,
    afterBalanceChange: after,
    processId: "p1",
    onError,
    ...overrides,
  });
  return { meter, debit, after, onError };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createCallMeter — batching", () => {
  it("uses the contract's cadence: every 5 s or 100 calls", () => {
    expect(CALL_FLUSH_INTERVAL_MS).toBe(5_000);
    expect(CALL_FLUSH_MAX_CALLS).toBe(100);
    expect(TOOL_CALL_DEBIT_KIND).toBe("usage_tool_call");
  });

  it("debits nothing until the interval, then one row per user", async () => {
    const { meter, debit } = setup();
    meter.record("u1");
    meter.record("u1");
    meter.record("u2");
    expect(debit).not.toHaveBeenCalled();
    expect(meter.pendingCalls()).toBe(3);

    await vi.advanceTimersByTimeAsync(5_000);

    expect(debit).toHaveBeenCalledTimes(2);
    const byUser = Object.fromEntries(debit.mock.calls.map(([a]) => [a.userId, a]));
    expect(byUser.u1).toMatchObject({
      amountMicros: 200,
      kind: "usage_tool_call",
      units: { calls: 2 },
    });
    expect(byUser.u2).toMatchObject({ amountMicros: 100, units: { calls: 1 } });
    expect(meter.pendingCalls()).toBe(0);
  });

  it("flushes at once when 100 calls are pending, without waiting for the timer", async () => {
    const { meter, debit } = setup();
    for (let i = 0; i < 99; i++) meter.record("u1");
    expect(debit).not.toHaveBeenCalled();
    meter.record("u1");
    await vi.advanceTimersByTimeAsync(0);
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][0]).toMatchObject({ amountMicros: 10_000, units: { calls: 100 } });
  });

  it("mints keys calls:<userId>:<processId>:<seq>, never reused", async () => {
    const { meter, debit } = setup();
    meter.record("u1");
    await meter.flush();
    meter.record("u1");
    await meter.flush();
    const keys = debit.mock.calls.map(([a]) => a.idempotencyKey);
    expect(keys).toEqual(["calls:u1:p1:1", "calls:u1:p1:2"]);
  });

  it("ignores empty user ids and non-positive counts", async () => {
    const { meter, debit } = setup();
    meter.record("");
    meter.record("u1", 0);
    meter.record("u1", -3);
    meter.record("u1", Number.NaN);
    await meter.flush();
    expect(debit).not.toHaveBeenCalled();
  });

  it("writes no ledger row when the price is 0", async () => {
    const { meter, debit } = setup({ priceToolCallsMicros: () => 0 });
    meter.record("u1");
    await meter.flush();
    expect(debit).not.toHaveBeenCalled();
    expect(meter.pendingCalls()).toBe(0);
  });

  it("prices the whole batch at once with the real pricing helper", async () => {
    const { meter, debit } = setup({ priceToolCallsMicros });
    for (let i = 0; i < 7; i++) meter.record("u1");
    await meter.flush();
    expect(debit.mock.calls[0][0].amountMicros).toBe(priceToolCallsMicros(7));
    expect(Number.isInteger(debit.mock.calls[0][0].amountMicros)).toBe(true);
  });
});

describe("createCallMeter — idempotency and failures", () => {
  it("retries a failed debit with the same key and amount", async () => {
    const { meter, debit, onError } = setup();
    debit.mockRejectedValueOnce(new Error("db down"));
    meter.record("u1", 3);
    await meter.flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(meter.pendingCalls()).toBe(3);

    // Calls recorded meanwhile get their own, new key.
    meter.record("u1");
    await vi.advanceTimersByTimeAsync(5_000);

    const calls = debit.mock.calls.map(([a]) => [a.idempotencyKey, a.amountMicros]);
    expect(calls).toEqual([
      ["calls:u1:p1:1", 300],
      ["calls:u1:p1:1", 300],
      ["calls:u1:p1:2", 100],
    ]);
    expect(meter.pendingCalls()).toBe(0);
  });

  it("a duplicate key (applied=false) is settled and fires no follow-up", async () => {
    const { meter, debit, after } = setup();
    debit.mockResolvedValueOnce({ ...OK, applied: false });
    meter.record("u1");
    await meter.flush();
    expect(after).not.toHaveBeenCalled();
    expect(meter.pendingCalls()).toBe(0);
  });

  it("hands an applied debit's result to the follow-ups", async () => {
    const crossed = { ...OK, totalMicros: -100, crossedZero: true };
    const { meter, debit, after } = setup();
    debit.mockResolvedValueOnce(crossed);
    meter.record("u1");
    await meter.flush();
    expect(after).toHaveBeenCalledWith("u1", crossed);
  });

  it("a throwing follow-up never breaks the flush", async () => {
    const { meter } = setup({
      afterBalanceChange: () => {
        throw new Error("boom");
      },
    });
    meter.record("u1");
    await expect(meter.flush()).resolves.toBeUndefined();
    expect(meter.pendingCalls()).toBe(0);
  });

  it("gives up after maxAttempts and reports the batch as abandoned", async () => {
    const { meter, debit, onError } = setup({ maxAttempts: 2 });
    debit.mockRejectedValue(new Error("constraint"));
    meter.record("u1");
    await meter.flush();
    await meter.flush();
    expect(debit).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls.map((c) => c[2])).toEqual([false, true]);
    expect(meter.pendingCalls()).toBe(0);
  });

  it("flush never rejects and waits for a flush already running", async () => {
    let release: (v: CallDebitResult) => void = () => {};
    const { meter, debit } = setup();
    debit.mockImplementationOnce(() => new Promise<CallDebitResult>((r) => (release = r)));
    meter.record("u1");
    const first = meter.flush();
    let secondDone = false;
    const second = meter.flush().then(() => (secondDone = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(secondDone).toBe(false);
    release(OK);
    await first;
    await second;
    expect(secondDone).toBe(true);
  });
});

describe("process singleton", () => {
  it("has a process id with a random part, so restarts never reuse keys", () => {
    expect(CALL_METER_PROCESS_ID).toMatch(/^\d+-[0-9a-f]{8}$/);
  });
});

describe("createBurstLimiter (per-minute abuse limiter)", () => {
  it("defaults to 600 tool calls per minute", () => {
    expect(CALLS_PER_MINUTE).toBe(600);
  });

  it("allows `limit` calls per user per minute, then refuses until the window ends", () => {
    const l = createBurstLimiter(3);
    const t0 = 1_700_000_040_000; // a minute boundary
    expect(l.check("u1", t0)).toEqual({ ok: true, limit: 3, remaining: 2, reset: t0 + 60_000 });
    expect(l.check("u1", t0 + 1).ok).toBe(true);
    expect(l.check("u1", t0 + 2).ok).toBe(true);
    expect(l.check("u1", t0 + 3)).toEqual({
      ok: false,
      limit: 3,
      remaining: 0,
      reset: t0 + 60_000,
    });
    // Other users have their own window.
    expect(l.check("u2", t0 + 3).ok).toBe(true);
    // Next minute: allowed again.
    expect(l.check("u1", t0 + 60_000).ok).toBe(true);
  });

  it("reset() forgets every window", () => {
    const l = createBurstLimiter(1);
    expect(l.check("u1", 0).ok).toBe(true);
    expect(l.check("u1", 1).ok).toBe(false);
    l.reset();
    expect(l.check("u1", 2).ok).toBe(true);
  });
});

describe("walletAllowsCall (the gate) fails closed", () => {
  it("passes the ledger's answer through", async () => {
    mocks.hasCredit.mockResolvedValueOnce(true);
    expect(await walletAllowsCall("u1")).toBe(true);
    mocks.hasCredit.mockResolvedValueOnce(false);
    expect(await walletAllowsCall("u1")).toBe(false);
  });

  it("answers false when the ledger throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasCredit.mockRejectedValueOnce(new Error("db down"));
    expect(await walletAllowsCall("u1")).toBe(false);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
