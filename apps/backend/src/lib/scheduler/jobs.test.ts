import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { JOBS } from "./jobs";
import { assertValidSchedule, periodMs } from "./schedule";

const CRON_DIR = resolve(__dirname, "../../app/api/cron");

describe("scheduler job table", () => {
  it("has exactly one job per /api/cron/* route", () => {
    const routes = readdirSync(CRON_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(JOBS.map((j) => j.name).sort()).toEqual(routes);
  });

  it("has unique names and valid schedules", () => {
    expect(new Set(JOBS.map((j) => j.name)).size).toBe(JOBS.length);
    for (const j of JOBS) expect(() => assertValidSchedule(j.schedule)).not.toThrow();
  });

  it("gives every job a timeout shorter than its period", () => {
    for (const j of JOBS) {
      expect(j.timeoutMs).toBeGreaterThan(0);
      expect(j.timeoutMs).toBeLessThan(periodMs(j.schedule));
    }
  });

  it("keeps the wallet cadence the billing depends on", () => {
    const by = Object.fromEntries(JOBS.map((j) => [j.name, j.schedule]));
    expect(by["meter-boxes"]).toEqual({ kind: "every", minutes: 5 });
    expect(by["wallet-enforce"]).toEqual({ kind: "every", minutes: 10, offsetMinutes: 2 });
    expect(by["wallet-expiry"]).toMatchObject({ kind: "every", minutes: 60 });
    expect(by["wallet-reminders"]).toEqual({ kind: "daily", hour: 8, minute: 0 });
    expect(by.purge).toEqual({ kind: "daily", hour: 3, minute: 30 });
    for (const daily of ["digest", "churn", "nudges"]) {
      expect(by[daily]?.kind).toBe("daily");
    }
  });

  it("lists meter-boxes first, so it wins a concurrency slot over the rest", () => {
    expect(JOBS[0]?.name).toBe("meter-boxes");
  });
});
