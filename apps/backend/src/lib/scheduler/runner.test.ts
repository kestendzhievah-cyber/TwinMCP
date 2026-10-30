import { describe, it, expect, vi } from "vitest";
import { SchedulerRunner, emptyState, type RunnerOptions } from "./runner";
import { MemoryStore, type ClaimStore } from "./store";
import { type JobDef, type JobOutcome } from "./jobs";

const T0 = Date.parse("2026-10-30T10:03:00.000Z");

function harness(jobs: JobDef[], extra: Partial<RunnerOptions> = {}) {
  let nowMs = T0;
  const clock = () => new Date(nowMs);
  const store = (extra.store as MemoryStore | undefined) ?? new MemoryStore(clock);
  const state = emptyState();
  const lines: string[] = [];
  const onError = vi.fn();
  const runner = new SchedulerRunner({
    jobs,
    store,
    instanceId: "test:1",
    state,
    now: clock,
    random: () => 0,
    log: (l) => lines.push(l),
    onError,
    bootBaseMs: 0,
    bootSpreadMs: 0,
    ...extra,
  });
  return {
    runner,
    store,
    state,
    lines,
    onError,
    clock,
    set: (iso: string) => {
      nowMs = Date.parse(iso);
    },
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function job(name: string, run: () => Promise<JobOutcome>, over: Partial<JobDef> = {}): JobDef {
  return { name, schedule: { kind: "every", minutes: 5 }, timeoutMs: 60_000, run, ...over };
}

const ok = (summary = "done"): Promise<JobOutcome> => Promise.resolve({ summary });

describe("SchedulerRunner", () => {
  it("does not run anything at boot: the first run is the next slot", async () => {
    const run = vi.fn(() => ok());
    const h = harness([job("meter-boxes", run)]);
    expect(await h.runner.tick()).toEqual([]);
    expect(run).not.toHaveBeenCalled();
    expect(h.state.jobs["meter-boxes"]?.nextRunAt?.toISOString()).toBe("2026-10-30T10:05:00.000Z");
  });

  it("runs a due job once per slot and records the outcome", async () => {
    const run = vi.fn(() => ok("3/3 box(es)"));
    const h = harness([job("meter-boxes", run)]);
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z");
    expect(await h.runner.tick()).toEqual(["meter-boxes"]);
    await h.runner.drain();
    expect(await h.runner.tick()).toEqual([]); // same slot: not again
    expect(run).toHaveBeenCalledTimes(1);
    const js = h.state.jobs["meter-boxes"]!;
    expect(js.lastOk).toBe(true);
    expect(js.lastSummary).toBe("3/3 box(es)");
    expect(js.runs).toBe(1);
    expect(js.nextRunAt?.toISOString()).toBe("2026-10-30T10:10:00.000Z");
    expect(h.lines.some((l) => l.startsWith("[scheduler] meter-boxes ok in"))).toBe(true);
    const { rows } = await h.store.list();
    expect(rows[0]?.lockedBy).toBeNull();
    expect(rows[0]?.lastRunBy).toBe("test:1");
  });

  it("runs a missed backlog once, not once per missed slot", async () => {
    const run = vi.fn(() => ok());
    const h = harness([job("meter-boxes", run)]);
    await h.runner.tick();
    h.set("2026-10-30T13:00:30.000Z"); // 3 h of missed slots
    await h.runner.tick();
    await h.runner.drain();
    await h.runner.tick();
    await h.runner.drain();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("never overlaps itself, even when the next slot comes while it runs", async () => {
    let release!: () => void;
    const run = vi.fn(
      () =>
        new Promise<JobOutcome>((resolve) => {
          release = () => resolve({ summary: "slow" });
        })
    );
    const h = harness([job("meter-boxes", run, { timeoutMs: 60 * 60_000 })]);
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z");
    await h.runner.tick();
    h.set("2026-10-30T10:10:01.000Z");
    expect(await h.runner.tick()).toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await h.runner.drain();
    expect(await h.runner.tick()).toEqual(["meter-boxes"]);
    release();
    await h.runner.drain();
  });

  it("lets only one of two processes claim a slot", async () => {
    const runA = vi.fn(() => ok());
    const runB = vi.fn(() => ok());
    const a = harness([job("purge", runA)]);
    const b = harness([job("purge", runB)], { store: a.store, instanceId: "test:2" });
    await a.runner.tick();
    a.set("2026-10-30T10:05:01.000Z");
    b.set("2026-10-30T10:05:01.000Z");
    await Promise.all([a.runner.tick(), b.runner.tick()]);
    await Promise.all([a.runner.drain(), b.runner.drain()]);
    expect(runA.mock.calls.length + runB.mock.calls.length).toBe(1);
  });

  it("catches sync throws and rejections, records them, keeps going", async () => {
    const boom = job("digest", () => {
      throw new Error("RESEND down");
    });
    const reject = job("churn", () => Promise.reject(new Error("db gone")));
    const fine = vi.fn(() => ok());
    const h = harness([boom, reject, job("nudges", fine)], { maxConcurrent: 5 });
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z");
    expect(await h.runner.tick()).toEqual(["digest", "churn", "nudges"]);
    await h.runner.drain();
    expect(h.state.jobs.digest?.lastOk).toBe(false);
    expect(h.state.jobs.digest?.lastError).toBe("RESEND down");
    expect(h.state.jobs.churn?.lastError).toBe("db gone");
    expect(h.state.jobs.nudges?.lastOk).toBe(true);
    expect(h.onError).toHaveBeenCalledTimes(2);
    expect(h.lines.some((l) => l.includes("digest FAILED"))).toBe(true);
    // The failed jobs are rescheduled to their next slot, lease released.
    const { rows } = await h.store.list();
    expect(rows.every((r) => r.lockedBy === null)).toBe(true);
  });

  it("reports partial errors (ok: false) without an error message", async () => {
    const h = harness([
      job("meter-boxes", () => Promise.resolve({ summary: "1 error", ok: false })),
    ]);
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z");
    await h.runner.tick();
    await h.runner.drain();
    expect(h.state.jobs["meter-boxes"]?.lastOk).toBe(false);
    expect(h.state.jobs["meter-boxes"]?.failures).toBe(1);
    expect(h.lines.some((l) => l.includes("meter-boxes done with errors"))).toBe(true);
  });

  it("times out, keeps the lease while the work runs, releases it when it settles", async () => {
    let release!: () => void;
    const h = harness([
      job(
        "purge",
        () =>
          new Promise<JobOutcome>((resolve) => {
            release = () => resolve({ summary: "late" });
          }),
        { timeoutMs: 20 }
      ),
    ]);
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z");
    await h.runner.tick();
    await new Promise((r) => setTimeout(r, 40));
    expect(h.state.jobs.purge?.lastOk).toBe(false);
    expect(h.state.jobs.purge?.lastError).toMatch(/timed out/);
    expect(h.state.jobs.purge?.running).toBe(true);
    let { rows } = await h.store.list();
    expect(rows[0]?.lockedBy).toBe("test:1");
    release();
    await h.runner.drain();
    ({ rows } = await h.store.list());
    expect(rows[0]?.lockedBy).toBeNull();
    expect(h.state.jobs.purge?.running).toBe(false);
    // The real outcome replaces the "timed out" record.
    expect(h.state.jobs.purge?.lastOk).toBe(true);
    expect(h.state.jobs.purge?.lastError).toBeNull();
    expect(h.state.jobs.purge?.lastSummary).toBe("late (late)");
    expect(rows[0]?.lastOk).toBe(true);
  });

  it("retries a run abandoned mid-way (crash/redeploy) once its lease expires", async () => {
    const run = vi.fn(() => ok());
    const h = harness([job("digest", run, { schedule: { kind: "daily", hour: 7, minute: 0 } })]);
    h.set("2026-10-31T06:59:00.000Z");
    await h.runner.tick(); // seeds next 07:00
    // Another instance claimed 07:00 and died: lease held, no finish recorded.
    h.set("2026-10-31T07:00:05.000Z");
    expect(
      await h.store.claim("digest", new Date("2026-11-01T07:00:00.000Z"), 60_000, "dead:1")
    ).toBe(true);
    await h.runner.tick();
    expect(run).not.toHaveBeenCalled(); // lease still held
    h.set("2026-10-31T07:02:00.000Z");
    expect(await h.runner.tick()).toEqual(["digest"]);
    await h.runner.drain();
    expect(run).toHaveBeenCalledTimes(1);
    const { rows } = await h.store.list();
    expect(rows[0]?.nextRunAt.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(rows[0]?.lockedBy).toBeNull();
    // Recorded now: not retried again.
    h.advance(10 * 60_000);
    expect(await h.runner.tick()).toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(h.lines.some((l) => l.includes("abandoned"))).toBe(true);
  });

  it("forgets a timed-out run that never settles (hard ceiling)", async () => {
    const h = harness([job("purge", () => new Promise<JobOutcome>(() => {}), { timeoutMs: 10 })], {
      hardCeilingFactor: 2,
    });
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z");
    await h.runner.tick();
    await h.runner.drain();
    expect(h.state.jobs.purge?.running).toBe(false);
    expect(h.lines.some((l) => l.includes("never settled"))).toBe(true);
  });

  it("pulls the next run earlier when a batched job asks for a follow-up", async () => {
    const h = harness([
      job("purge", () => Promise.resolve({ summary: "truncated", followUpMs: 15 * 60_000 }), {
        schedule: { kind: "daily", hour: 10, minute: 30 },
      }),
    ]);
    await h.runner.tick();
    h.set("2026-10-30T10:30:05.000Z");
    await h.runner.tick();
    await h.runner.drain();
    const { rows } = await h.store.list();
    expect(rows[0]?.nextRunAt.toISOString()).toBe("2026-10-30T10:45:05.000Z");
  });

  it("caps concurrent runs and respects each job's boot delay", async () => {
    const runs = ["a", "b", "c"].map(() => vi.fn(() => ok()));
    const h = harness([job("a", runs[0]!), job("b", runs[1]!), job("c", runs[2]!)], {
      maxConcurrent: 2,
      bootBaseMs: 5 * 60_000,
    });
    await h.runner.tick();
    h.set("2026-10-30T10:05:01.000Z"); // due, but inside the 5-min boot delay
    expect(await h.runner.tick()).toEqual([]);
    h.set("2026-10-30T10:08:01.000Z");
    expect(await h.runner.tick()).toEqual(["a", "b"]);
    await h.runner.drain();
    expect(await h.runner.tick()).toEqual(["c"]);
    await h.runner.drain();
  });

  it("resets a stored next run that the schedule no longer allows", async () => {
    const h = harness([job("wallet-expiry", () => ok())]);
    await h.store.ensure([{ name: "wallet-expiry", nextRunAt: new Date("2026-11-30T00:00:00Z") }]);
    await h.runner.tick();
    const { rows } = await h.store.list();
    expect(rows[0]?.nextRunAt.toISOString()).toBe("2026-10-30T10:05:00.000Z");
  });

  it("falls back to in-process coordination when scheduler_runs is missing, and back", async () => {
    let tableExists = false;
    const missing = Object.assign(new Error('relation "scheduler_runs" does not exist'), {
      code: "42P01",
    });
    let nowMs = T0;
    const clock = () => new Date(nowMs);
    const inner = new MemoryStore(clock);
    const pg: ClaimStore = {
      kind: "postgres",
      ensure: (j) => (tableExists ? inner.ensure(j) : Promise.reject(missing)),
      list: () => (tableExists ? inner.list() : Promise.reject(missing)),
      claim: (...a) => inner.claim(...a),
      finish: (...a) => inner.finish(...a),
      release: (...a) => inner.release(...a),
      resetNext: (...a) => inner.resetNext(...a),
    };
    const run = vi.fn(() => ok());
    const state = emptyState();
    const lines: string[] = [];
    const runner = new SchedulerRunner({
      jobs: [job("meter-boxes", run)],
      store: pg,
      fallback: () => new MemoryStore(clock),
      instanceId: "test:1",
      state,
      now: clock,
      random: () => 0,
      log: (l) => lines.push(l),
      bootBaseMs: 0,
      bootSpreadMs: 0,
      primaryRetryMs: 60_000,
    });
    await runner.tick();
    expect(runner.coordination).toBe("memory");
    expect(state.coordination).toBe("memory");
    expect(lines.some((l) => l.includes("migration 0021 not applied"))).toBe(true);
    await runner.tick(); // seeds the memory store (next slot 10:05)
    nowMs = Date.parse("2026-10-30T10:05:01.000Z");
    await runner.tick();
    await runner.drain();
    expect(run).toHaveBeenCalledTimes(1);

    tableExists = true;
    nowMs += 60_000;
    await runner.tick();
    expect(runner.coordination).toBe("postgres");
  });

  it("survives a failing store without throwing and logs the failure once", async () => {
    const broken: ClaimStore = {
      kind: "postgres",
      ensure: () => Promise.reject(new Error("ECONNREFUSED")),
      list: () => Promise.reject(new Error("ECONNREFUSED")),
      claim: () => Promise.reject(new Error("ECONNREFUSED")),
      finish: () => Promise.reject(new Error("ECONNREFUSED")),
      release: () => Promise.reject(new Error("ECONNREFUSED")),
      resetNext: () => Promise.reject(new Error("ECONNREFUSED")),
    };
    const h = harness([job("meter-boxes", () => ok())], {
      store: broken as unknown as MemoryStore,
    });
    await expect(h.runner.tick()).resolves.toEqual([]);
    await h.runner.tick();
    expect(h.state.lastTickError).toBe("ECONNREFUSED");
    expect(h.lines.filter((l) => l.includes("tick failed")).length).toBe(1);
  });
});
