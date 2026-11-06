import { describe, expect, it } from "vitest";
import { REPAIR_DEFAULTS, selectRepairs, type RepairAttempt } from "@/lib/mcp/repair-installs";

const MIN = 60_000;
const NOW = Date.parse("2026-11-07T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * MIN);

describe("selectRepairs", () => {
  it("leaves recent installs alone (still legitimately in progress)", () => {
    const r = selectRepairs([{ id: "a", installedAt: ago(5) }], new Map(), NOW);
    expect(r).toEqual({ retry: [], exhausted: [] });
  });

  it("retries an old stuck install that was never retried", () => {
    const r = selectRepairs([{ id: "a", installedAt: ago(60) }], new Map(), NOW);
    expect(r.retry).toEqual(["a"]);
  });

  it("backs off between retries: 30 min, then 60 min", () => {
    const rows = [{ id: "a", installedAt: ago(600) }];
    const once = new Map<string, RepairAttempt>([["a", { count: 1, lastAt: NOW - 20 * MIN }]]);
    expect(selectRepairs(rows, once, NOW).retry).toEqual([]);
    once.set("a", { count: 1, lastAt: NOW - 31 * MIN });
    expect(selectRepairs(rows, once, NOW).retry).toEqual(["a"]);
    const twice = new Map<string, RepairAttempt>([["a", { count: 2, lastAt: NOW - 45 * MIN }]]);
    expect(selectRepairs(rows, twice, NOW).retry).toEqual([]);
    twice.set("a", { count: 2, lastAt: NOW - 61 * MIN });
    expect(selectRepairs(rows, twice, NOW).retry).toEqual(["a"]);
  });

  it("stops after the attempt budget and reports the row", () => {
    const rows = [{ id: "a", installedAt: ago(1000) }];
    const spent = new Map<string, RepairAttempt>([
      ["a", { count: REPAIR_DEFAULTS.maxAttempts, lastAt: NOW - 1000 * MIN }],
    ]);
    expect(selectRepairs(rows, spent, NOW)).toEqual({ retry: [], exhausted: ["a"] });
  });

  it("treats a missing installed_at as old", () => {
    expect(selectRepairs([{ id: "a", installedAt: null }], new Map(), NOW).retry).toEqual(["a"]);
  });
});
