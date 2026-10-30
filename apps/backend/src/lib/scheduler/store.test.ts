import { describe, it, expect } from "vitest";
import { isAbandonedRun } from "./store";

const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;

describe("isAbandonedRun", () => {
  const base = {
    lockedBy: "host:1:abc",
    lockedUntil: at("2026-10-30T07:05:00.000Z"),
    lastStartedAt: at("2026-10-30T07:00:00.000Z"),
    lastFinishedAt: at("2026-10-29T07:00:30.000Z"),
  };
  const now = at("2026-10-30T07:10:00.000Z");

  it("is a held, expired lease with no finish after its start", () => {
    expect(isAbandonedRun(base, now, 24 * HOUR)).toBe(true);
    expect(isAbandonedRun({ ...base, lastFinishedAt: null }, now, 24 * HOUR)).toBe(true);
  });

  it("is not while the lease is still live", () => {
    expect(isAbandonedRun(base, at("2026-10-30T07:04:00.000Z"), 24 * HOUR)).toBe(false);
  });

  it("is not once a finish was recorded (completed or timed out)", () => {
    const finished = { ...base, lastFinishedAt: at("2026-10-30T07:03:00.000Z") };
    expect(isAbandonedRun(finished, now, 24 * HOUR)).toBe(false);
  });

  it("is not when the lease was released", () => {
    expect(isAbandonedRun({ ...base, lockedBy: null }, now, 24 * HOUR)).toBe(false);
    expect(isAbandonedRun({ ...base, lockedUntil: null }, now, 24 * HOUR)).toBe(false);
  });

  it("is not for a run older than the window", () => {
    expect(isAbandonedRun(base, now, 5 * 60_000)).toBe(false);
  });
});
