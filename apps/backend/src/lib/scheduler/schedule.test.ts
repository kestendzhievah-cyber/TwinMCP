import { describe, it, expect } from "vitest";
import {
  assertValidSchedule,
  bootDelayMs,
  describeSchedule,
  isStoredNextStale,
  nextAfterClaim,
  nextRunAfter,
  periodMs,
  type Schedule,
} from "./schedule";

const at = (iso: string) => new Date(iso);
const next = (s: Schedule, iso: string) => nextRunAfter(s, at(iso)).toISOString();

describe("nextRunAfter — every N minutes", () => {
  const every5: Schedule = { kind: "every", minutes: 5 };

  it("returns the next aligned slot", () => {
    expect(next(every5, "2026-10-30T10:03:12.000Z")).toBe("2026-10-30T10:05:00.000Z");
    expect(next(every5, "2026-10-30T10:59:59.999Z")).toBe("2026-10-30T11:00:00.000Z");
  });

  it("is strictly after: a time on a slot gets the following slot", () => {
    expect(next(every5, "2026-10-30T10:05:00.000Z")).toBe("2026-10-30T10:10:00.000Z");
  });

  it("applies the offset after each slot", () => {
    const enforce: Schedule = { kind: "every", minutes: 10, offsetMinutes: 2 };
    expect(next(enforce, "2026-10-30T10:00:00.000Z")).toBe("2026-10-30T10:02:00.000Z");
    expect(next(enforce, "2026-10-30T10:02:00.000Z")).toBe("2026-10-30T10:12:00.000Z");
    expect(next(enforce, "2026-10-30T10:01:59.000Z")).toBe("2026-10-30T10:02:00.000Z");
    expect(next(enforce, "2026-10-30T10:55:00.000Z")).toBe("2026-10-30T11:02:00.000Z");
  });

  it("supports hourly at a fixed minute, across midnight and year end", () => {
    const hourly: Schedule = { kind: "every", minutes: 60, offsetMinutes: 17 };
    expect(next(hourly, "2026-10-30T10:16:00.000Z")).toBe("2026-10-30T10:17:00.000Z");
    expect(next(hourly, "2026-10-30T10:17:00.000Z")).toBe("2026-10-30T11:17:00.000Z");
    expect(next(hourly, "2026-12-31T23:30:00.000Z")).toBe("2027-01-01T00:17:00.000Z");
  });

  it("wallet-enforce always lands 2 minutes after a meter slot", () => {
    const meter: Schedule = { kind: "every", minutes: 5 };
    const enforce: Schedule = { kind: "every", minutes: 10, offsetMinutes: 2 };
    let t = at("2026-10-30T00:00:30.000Z");
    for (let i = 0; i < 20; i++) {
      const e = nextRunAfter(enforce, t);
      const m = nextRunAfter(meter, new Date(e.getTime() - 2 * 60_000 - 1));
      expect(e.getTime() - m.getTime()).toBe(2 * 60_000);
      t = e;
    }
  });
});

describe("nextRunAfter — daily HH:MM UTC", () => {
  const at0800: Schedule = { kind: "daily", hour: 8, minute: 0 };

  it("is today when the time is still ahead", () => {
    expect(next(at0800, "2026-10-30T07:59:59.000Z")).toBe("2026-10-30T08:00:00.000Z");
  });

  it("is tomorrow on or after the time", () => {
    expect(next(at0800, "2026-10-30T08:00:00.000Z")).toBe("2026-10-31T08:00:00.000Z");
    expect(next(at0800, "2026-10-30T23:59:00.000Z")).toBe("2026-10-31T08:00:00.000Z");
  });

  it("rolls over months, leap days and years, in UTC (no DST)", () => {
    const at0330: Schedule = { kind: "daily", hour: 3, minute: 30 };
    expect(next(at0330, "2026-10-31T04:00:00.000Z")).toBe("2026-11-01T03:30:00.000Z");
    expect(next(at0330, "2028-02-28T12:00:00.000Z")).toBe("2028-02-29T03:30:00.000Z");
    expect(next(at0330, "2026-12-31T05:00:00.000Z")).toBe("2027-01-01T03:30:00.000Z");
    // Paris DST change (2026-10-25): UTC slots are unaffected.
    expect(next(at0330, "2026-10-25T00:00:00.000Z")).toBe("2026-10-25T03:30:00.000Z");
  });
});

describe("nextAfterClaim", () => {
  it("skips a boundary a few ms ahead (clock skew) instead of re-running it", () => {
    const every5: Schedule = { kind: "every", minutes: 5 };
    const claimed = at("2026-10-30T10:04:59.999Z");
    expect(nextRunAfter(every5, claimed).toISOString()).toBe("2026-10-30T10:05:00.000Z");
    expect(nextAfterClaim(every5, claimed).toISOString()).toBe("2026-10-30T10:10:00.000Z");
  });

  it("is the plain next slot otherwise", () => {
    const daily: Schedule = { kind: "daily", hour: 8, minute: 0 };
    expect(nextAfterClaim(daily, at("2026-10-30T08:00:31.000Z")).toISOString()).toBe(
      "2026-10-31T08:00:00.000Z"
    );
  });
});

describe("isStoredNextStale", () => {
  const every5: Schedule = { kind: "every", minutes: 5 };
  const now = at("2026-10-30T10:03:00.000Z");

  it("accepts a due or upcoming slot", () => {
    expect(isStoredNextStale(every5, at("2026-10-30T09:00:00.000Z"), now)).toBe(false);
    expect(isStoredNextStale(every5, at("2026-10-30T10:05:00.000Z"), now)).toBe(false);
  });

  it("flags a slot later than the schedule allows (schedule changed in code)", () => {
    // Was daily at 08:00 tomorrow, now every 5 minutes.
    expect(isStoredNextStale(every5, at("2026-10-31T08:00:00.000Z"), now)).toBe(true);
  });
});

describe("assertValidSchedule / periodMs / describeSchedule", () => {
  it("accepts the shapes the job table uses", () => {
    for (const s of [
      { kind: "every", minutes: 5 },
      { kind: "every", minutes: 10, offsetMinutes: 2 },
      { kind: "every", minutes: 60, offsetMinutes: 17 },
      { kind: "daily", hour: 3, minute: 30 },
    ] as Schedule[]) {
      expect(() => assertValidSchedule(s)).not.toThrow();
    }
  });

  it("rejects schedules that would drift or never fire", () => {
    expect(() => assertValidSchedule({ kind: "every", minutes: 7 })).toThrow();
    expect(() => assertValidSchedule({ kind: "every", minutes: 0 })).toThrow();
    expect(() => assertValidSchedule({ kind: "every", minutes: 10, offsetMinutes: 10 })).toThrow();
    expect(() => assertValidSchedule({ kind: "daily", hour: 24, minute: 0 })).toThrow();
    expect(() => assertValidSchedule({ kind: "daily", hour: 8, minute: 60 })).toThrow();
  });

  it("reports the period and a readable label", () => {
    expect(periodMs({ kind: "every", minutes: 5 })).toBe(300_000);
    expect(periodMs({ kind: "daily", hour: 8, minute: 0 })).toBe(86_400_000);
    expect(describeSchedule({ kind: "every", minutes: 5 })).toBe("every 5 min");
    expect(describeSchedule({ kind: "every", minutes: 10, offsetMinutes: 2 })).toBe(
      "every 10 min +2"
    );
    expect(describeSchedule({ kind: "every", minutes: 60, offsetMinutes: 17 })).toBe(
      "hourly at :17"
    );
    expect(describeSchedule({ kind: "daily", hour: 3, minute: 30 })).toBe("daily 03:30 UTC");
  });
});

describe("bootDelayMs", () => {
  it("spreads between base and base + spread, clamped", () => {
    expect(bootDelayMs(60_000, 120_000, () => 0)).toBe(60_000);
    expect(bootDelayMs(60_000, 120_000, () => 0.5)).toBe(120_000);
    expect(bootDelayMs(60_000, 120_000, () => 1)).toBe(180_000);
    expect(bootDelayMs(60_000, 120_000, () => 7)).toBe(180_000);
  });
});
