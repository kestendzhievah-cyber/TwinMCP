import { describe, expect, it, vi } from "vitest";
import { followUpsFor, runFollowUps, type AfterDeps } from "./after-debit";

function deps(over: Partial<AfterDeps> = {}) {
  const calls: string[] = [];
  const d: AfterDeps = {
    maybeAutoRecharge: vi.fn(async (u: string) => {
      calls.push(`recharge:${u}`);
    }),
    notifyWalletState: vi.fn(async (u: string, e: string) => {
      calls.push(`notify:${u}:${e}`);
    }),
    readWallet: vi.fn(async () => ({ totalMicros: 0, thresholdMicros: 5_000_000 })),
    log: () => {},
    ...over,
  };
  return { d, calls };
}

describe("followUpsFor", () => {
  it("maps crossings to follow-ups, zero first", () => {
    const base = { totalMicros: 0, crossedZero: false, crossedThreshold: false };
    expect(followUpsFor(base)).toEqual({ autoRecharge: false, notify: null });
    expect(followUpsFor({ ...base, crossedThreshold: true })).toEqual({
      autoRecharge: true,
      notify: "low_balance",
    });
    expect(followUpsFor({ ...base, crossedZero: true, crossedThreshold: true })).toEqual({
      autoRecharge: true,
      notify: "zero_balance",
    });
    expect(followUpsFor({ ...base, applied: false, crossedZero: true })).toEqual({
      autoRecharge: false,
      notify: null,
    });
  });
});

describe("runFollowUps", () => {
  it("does nothing without a crossing", async () => {
    const { d, calls } = deps();
    await runFollowUps(d, "u", { totalMicros: 1, crossedZero: false, crossedThreshold: false });
    expect(calls).toEqual([]);
  });

  it("tries auto-recharge, then notifies when still empty", async () => {
    const { d, calls } = deps();
    await runFollowUps(d, "u", {
      totalMicros: -100,
      crossedZero: true,
      crossedThreshold: false,
      kind: "usage_compute",
    });
    expect(calls).toEqual(["recharge:u", "notify:u:zero_balance"]);
    expect(d.notifyWalletState).toHaveBeenCalledWith("u", "zero_balance", {
      totalMicros: -100,
      kind: "usage_compute",
    });
  });

  it("skips the email when auto-recharge restored the balance", async () => {
    const { d, calls } = deps({
      readWallet: async () => ({ totalMicros: 20_000_000, thresholdMicros: 5_000_000 }),
    });
    await runFollowUps(d, "u", {
      totalMicros: 4_000_000,
      crossedZero: false,
      crossedThreshold: true,
    });
    expect(calls).toEqual(["recharge:u"]);
  });

  it("still notifies when auto-recharge throws, and never rejects", async () => {
    const { d, calls } = deps({
      maybeAutoRecharge: async () => {
        throw new Error("card declined");
      },
      notifyWalletState: async (u, e) => {
        calls.push(`notify:${u}:${e}`);
        throw new Error("smtp down");
      },
    });
    await expect(
      runFollowUps(d, "u", { totalMicros: 0n, crossedZero: true, crossedThreshold: true })
    ).resolves.toBeUndefined();
    expect(calls).toEqual(["notify:u:zero_balance"]);
  });

  it("notifies when the re-read fails", async () => {
    const { d, calls } = deps({
      readWallet: async () => {
        throw new Error("db down");
      },
    });
    await runFollowUps(d, "u", { totalMicros: 1, crossedZero: false, crossedThreshold: true });
    expect(calls).toEqual(["recharge:u", "notify:u:low_balance"]);
  });
});
