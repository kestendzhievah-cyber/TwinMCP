import { describe, it, expect } from "vitest";
import { buildSchedulerHealth, redactError } from "./index";
import { emptyState, type SchedulerState } from "./runner";
import { type JobRow } from "./store";

const NOW = new Date("2026-10-30T10:07:00.000Z");

function row(over: Partial<JobRow>): JobRow {
  return {
    job: "meter-boxes",
    nextRunAt: new Date("2026-10-30T10:10:00.000Z"),
    lockedUntil: null,
    lockedBy: null,
    lastStartedAt: new Date("2026-10-30T10:05:02.000Z"),
    lastFinishedAt: new Date("2026-10-30T10:05:04.000Z"),
    lastOk: true,
    lastError: null,
    lastSummary: "3/3 box(es)",
    lastDurationMs: 2000,
    lastRunBy: "host:1:aa",
    runCount: 10,
    failCount: 0,
    ...over,
  };
}

function enabledState(over: Partial<SchedulerState> = {}): SchedulerState {
  return {
    ...emptyState(),
    enabled: true,
    reason: "production default",
    instanceId: "host:1:aa",
    startedAt: new Date("2026-10-30T09:00:00.000Z"),
    coordination: "postgres",
    lastTickAt: new Date("2026-10-30T10:06:40.000Z"),
    ...over,
  };
}

describe("buildSchedulerHealth", () => {
  it("reports per-job last run from the persisted rows, and leadership", () => {
    const h = buildSchedulerHealth(enabledState(), [row({})], NOW);
    expect(h.enabled).toBe(true);
    expect(h.leader).toBe(true);
    expect(h.jobs["meter-boxes"]).toMatchObject({
      lastOk: true,
      lastRunAt: "2026-10-30T10:05:02.000Z",
      nextRunAt: "2026-10-30T10:10:00.000Z",
      overdue: false,
      running: false,
    });
    expect(h.warnings).toEqual([]);
  });

  it("is not leader when another instance ran the latest job", () => {
    const h = buildSchedulerHealth(enabledState(), [row({ lastRunBy: "other:2:bb" })], NOW);
    expect(h.leader).toBe(false);
  });

  it("warns on failures, overdue jobs and the in-memory fallback", () => {
    const h = buildSchedulerHealth(
      enabledState({ coordination: "memory" }),
      [
        row({ lastOk: false, lastError: "connect ECONNREFUSED 10.0.0.5:5432" }),
        row({ job: "purge", nextRunAt: new Date("2026-10-28T03:30:00.000Z") }),
      ],
      NOW
    );
    expect(h.jobs["meter-boxes"]?.lastError).toBe("connect ECONNREFUSED <ip>");
    expect(h.jobs.purge?.overdue).toBe(true);
    expect(h.warnings.join("\n")).toMatch(/meter-boxes: last run failed/);
    expect(h.warnings.join("\n")).toMatch(/purge: overdue/);
    expect(h.warnings.join("\n")).toMatch(/migration 0021 not applied/);
  });

  it("does not warn about a job listed in INTERNAL_SCHEDULER_SKIP", () => {
    const h = buildSchedulerHealth(
      enabledState(),
      [
        row({}),
        row({ job: "digest", nextRunAt: new Date("2026-10-20T07:00:00.000Z"), lastOk: false }),
      ],
      NOW,
      new Set(["digest"])
    );
    expect(h.jobs.digest).toMatchObject({ skipped: true, overdue: false });
    expect(h.jobs["meter-boxes"]?.skipped).toBe(false);
    expect(h.warnings).toEqual([]);
  });

  it("never exposes the hostname-based instance id", () => {
    const h = buildSchedulerHealth(enabledState(), [row({})], NOW);
    expect(JSON.stringify(h)).not.toContain("host:1");
    expect(h.instance).toMatch(/^[0-9a-f]{8}$/);
    expect(h.jobs["meter-boxes"]?.lastRunBy).toBe(h.instance);
    expect(h.jobs["meter-boxes"]?.mine).toBe(true);
  });

  it("works with no rows and a scheduler that never started", () => {
    const h = buildSchedulerHealth(emptyState(), null, NOW);
    expect(h).toMatchObject({ enabled: false, leader: false, coordination: null, jobs: {} });
  });
});

describe("redactError", () => {
  it("drops urls, emails, addresses and tokens, and caps the length", () => {
    expect(redactError("fetch https://api.example.com/x?key=1 failed")).toBe("fetch <url> failed");
    expect(redactError("bounce for jane.doe@example.fr")).toBe("bounce for <email>");
    // Built at runtime so secret scanners do not flag a fake key in the source.
    const fakeKey = ["sk", "live", "FAKEFAKEFAKEFAKEFAKEFAKE0000"].join("_");
    expect(redactError(`Bearer ${fakeKey}`)).toBe("Bearer <redacted>");
    expect(redactError("x".repeat(10) + " " + "word ".repeat(60))?.length).toBeLessThanOrEqual(160);
    expect(redactError(null)).toBeNull();
  });
});
