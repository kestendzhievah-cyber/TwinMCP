// The scheduler loop. Every tick (≈30 s) it reads the claim store, and for
// each job whose slot is due and whose lease is free it claims the run
// atomically, then runs the job's library function in-process.
//
// Guarantees:
//  - a job never overlaps itself: in this process (in-flight map, kept until
//    the work really settles, even past its timeout) and across processes
//    (the lease in the claim store);
//  - a job never crashes the server: sync throws, rejections and timeouts
//    are caught, logged on one line and recorded;
//  - no burst at boot: each job waits a random boot delay before its first
//    run in this process, and at most `maxConcurrent` jobs run at once;
//  - a missed slot (container down) runs once on the next tick, not once per
//    missed slot;
//  - a run abandoned mid-way (crash, redeploy) is retried once its lease
//    expires, if it started within the job's last period (isAbandonedRun).

import { type JobDef, type JobOutcome } from "./jobs";
import {
  bootDelayMs,
  describeSchedule,
  isStoredNextStale,
  nextAfterClaim,
  nextRunAfter,
  periodMs,
} from "./schedule";
import { type ClaimStore, MemoryStore, isAbandonedRun, isMissingTable } from "./store";

export interface JobState {
  name: string;
  schedule: string;
  timeoutMs: number;
  running: boolean;
  nextRunAt: Date | null;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastOk: boolean | null;
  lastError: string | null;
  lastSummary: string | null;
  lastDurationMs: number | null;
  runs: number;
  failures: number;
}

export interface SchedulerState {
  enabled: boolean;
  reason: string;
  instanceId: string | null;
  startedAt: Date | null;
  coordination: "postgres" | "memory" | null;
  lastTickAt: Date | null;
  lastTickError: string | null;
  jobs: Record<string, JobState>;
}

export function emptyState(): SchedulerState {
  return {
    enabled: false,
    reason: "not started in this process",
    instanceId: null,
    startedAt: null,
    coordination: null,
    lastTickAt: null,
    lastTickError: null,
    jobs: {},
  };
}

export interface RunnerOptions {
  jobs: readonly JobDef[];
  /** Primary store (PgStore in production). */
  store: ClaimStore;
  instanceId: string;
  state: SchedulerState;
  now?: () => Date;
  random?: () => number;
  log?: (line: string) => void;
  /** Reported for thrown errors and timeouts (Sentry in production). */
  onError?: (err: unknown, job: string) => void;
  maxConcurrent?: number;
  /** Boot delay before a job's first run here: base + random × spread. */
  bootBaseMs?: number;
  bootSpreadMs?: number;
  /** Lease = job timeout + this grace. */
  leaseGraceMs?: number;
  /** A timed-out run whose work never settles is forgotten after timeout × this. */
  hardCeilingFactor?: number;
  /** While on the memory fallback, retry the primary store this often. */
  primaryRetryMs?: number;
  /** Fallback when the primary store's table is missing. */
  fallback?: () => ClaimStore;
}

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

export class SchedulerRunner {
  private store: ClaimStore;
  private readonly primary: ClaimStore;
  private ensured = false;
  private primaryProbeAt = 0;
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly notBefore = new Map<string, number>();
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly log: (line: string) => void;
  private lastLoggedTickError: string | null = null;

  constructor(private readonly opts: RunnerOptions) {
    this.primary = opts.store;
    this.store = opts.store;
    this.now = opts.now ?? (() => new Date());
    this.random = opts.random ?? Math.random;
    this.log = opts.log ?? ((l) => console.info(l));
    const t0 = this.now().getTime();
    const s = opts.state;
    s.instanceId = opts.instanceId;
    s.startedAt = new Date(t0);
    s.coordination = this.store.kind;
    for (const j of opts.jobs) {
      this.notBefore.set(
        j.name,
        t0 + bootDelayMs(opts.bootBaseMs ?? 60_000, opts.bootSpreadMs ?? 120_000, this.random)
      );
      s.jobs[j.name] = {
        name: j.name,
        schedule: describeSchedule(j.schedule),
        timeoutMs: j.timeoutMs,
        running: false,
        nextRunAt: null,
        lastStartedAt: null,
        lastFinishedAt: null,
        lastOk: null,
        lastError: null,
        lastSummary: null,
        lastDurationMs: null,
        runs: 0,
        failures: 0,
      };
    }
  }

  get coordination(): "postgres" | "memory" {
    return this.store.kind;
  }

  /** Resolves once every in-flight run has settled (tests, shutdown). */
  async drain(): Promise<void> {
    while (this.inflight.size > 0) await Promise.allSettled([...this.inflight.values()]);
  }

  private useStore(store: ClaimStore): void {
    this.store = store;
    this.ensured = false;
    this.opts.state.coordination = store.kind;
  }

  /** One pass: claim and launch every due job. Never throws, never awaits job work. */
  async tick(): Promise<string[]> {
    const launched: string[] = [];
    const now = this.now();
    const state = this.opts.state;
    state.lastTickAt = now;

    // Back on the primary store once its table exists (migration applied).
    if (
      this.store !== this.primary &&
      now.getTime() - this.primaryProbeAt >= (this.opts.primaryRetryMs ?? 10 * 60_000)
    ) {
      this.primaryProbeAt = now.getTime();
      try {
        await this.primary.list();
        this.useStore(this.primary);
        this.log("[scheduler] scheduler_runs found: coordinating through Postgres");
      } catch {
        // still missing / unreachable: stay on the fallback
      }
    }

    try {
      const store = this.store;
      if (!this.ensured) {
        await store.ensure(
          this.opts.jobs.map((j) => ({ name: j.name, nextRunAt: nextRunAfter(j.schedule, now) }))
        );
        this.ensured = true;
      }
      const { now: storeNow, rows } = await store.list();
      const byName = new Map(rows.map((r) => [r.job, r]));
      const nowMs = now.getTime();
      const storeMs = storeNow.getTime();

      for (const job of this.opts.jobs) {
        const row = byName.get(job.name);
        const js = state.jobs[job.name];
        if (!row) {
          this.ensured = false; // re-seeded next tick
          continue;
        }
        if (js) js.nextRunAt = row.nextRunAt;
        if (isStoredNextStale(job.schedule, row.nextRunAt, storeNow)) {
          const next = nextRunAfter(job.schedule, storeNow);
          await store.resetNext(job.name, next);
          if (js) js.nextRunAt = next;
          continue;
        }
        if (this.inflight.has(job.name)) continue;
        if (nowMs < (this.notBefore.get(job.name) ?? 0)) continue;
        const due = row.nextRunAt.getTime() <= storeMs;
        const abandoned = !due && isAbandonedRun(row, storeNow, periodMs(job.schedule));
        if (!due && !abandoned) continue;
        if (row.lockedUntil && row.lockedUntil.getTime() > storeMs) continue;
        if (this.inflight.size >= (this.opts.maxConcurrent ?? 2)) break;

        const lease = job.timeoutMs + (this.opts.leaseGraceMs ?? 60_000);
        if (abandoned) {
          // Same slot again: next_run_at is already the following one.
          if (!store.claimAbandoned) continue;
          if (!(await store.claimAbandoned(job.name, lease, this.opts.instanceId))) continue;
          this.log(`[scheduler] ${job.name}: retrying a run abandoned mid-way (crash or redeploy)`);
          this.launch(job, store);
          launched.push(job.name);
          continue;
        }
        const next = nextAfterClaim(job.schedule, storeNow);
        if (!(await store.claim(job.name, next, lease, this.opts.instanceId))) continue;
        if (js) js.nextRunAt = next;
        this.launch(job, store);
        launched.push(job.name);
      }
      state.lastTickError = null;
      this.lastLoggedTickError = null;
    } catch (err) {
      if (this.store.kind === "postgres" && isMissingTable(err) && this.opts.fallback) {
        this.primaryProbeAt = now.getTime();
        this.useStore(this.opts.fallback());
        this.log(
          "[scheduler] scheduler_runs is missing (migration 0021 not applied): coordinating in this process only"
        );
      } else {
        const msg = errMsg(err);
        state.lastTickError = msg;
        // One line per distinct failure, not one every 30 s.
        if (msg !== this.lastLoggedTickError) {
          this.lastLoggedTickError = msg;
          this.log(`[scheduler] tick failed: ${msg}`);
        }
      }
    }
    return launched;
  }

  private launch(job: JobDef, store: ClaimStore): void {
    const js = this.opts.state.jobs[job.name];
    const startedMs = this.now().getTime();
    if (js) {
      js.running = true;
      js.lastStartedAt = new Date(startedMs);
    }
    // Promise.resolve().then: a synchronous throw becomes a rejection.
    const work: Promise<JobOutcome> = Promise.resolve().then(() => job.run());
    const settled = work.then(
      (outcome) => ({ outcome }) as const,
      (error: unknown) => ({ error }) as const
    );

    const record = async (
      ok: boolean,
      error: string | null,
      summary: string | null,
      release: boolean,
      followUpMs?: number
    ) => {
      const finishedMs = this.now().getTime();
      const durationMs = finishedMs - startedMs;
      if (js) {
        js.lastFinishedAt = new Date(finishedMs);
        js.lastOk = ok;
        js.lastError = error;
        js.lastSummary = summary;
        js.lastDurationMs = durationMs;
        js.runs += 1;
        if (!ok) js.failures += 1;
      }
      const verdict = ok ? "ok" : error ? "FAILED" : "done with errors";
      this.log(
        `[scheduler] ${job.name} ${verdict} in ${secs(durationMs)}: ${error ?? summary ?? ""}`
      );
      try {
        await store.finish(job.name, this.opts.instanceId, {
          ok,
          error,
          summary,
          durationMs,
          release,
          followUpAt: followUpMs ? new Date(finishedMs + followUpMs) : undefined,
        });
      } catch (err) {
        this.log(`[scheduler] ${job.name}: could not record the run: ${errMsg(err)}`);
      }
    };

    const run = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), job.timeoutMs);
        (timer as { unref?: () => void }).unref?.();
      });
      const first = await Promise.race([settled, timedOut]);
      if (timer) clearTimeout(timer);

      if (first === "timeout") {
        const msg = `timed out after ${secs(job.timeoutMs)} (still running)`;
        this.opts.onError?.(new Error(`${job.name} ${msg}`), job.name);
        // The lease stays: the work may still be writing.
        await record(false, msg, null, false);
        let ceiling: ReturnType<typeof setTimeout> | undefined;
        const late = await Promise.race([
          settled,
          new Promise<false>((resolve) => {
            ceiling = setTimeout(
              () => resolve(false),
              job.timeoutMs * ((this.opts.hardCeilingFactor ?? 3) - 1)
            );
            (ceiling as { unref?: () => void }).unref?.();
          }),
        ]);
        if (ceiling) clearTimeout(ceiling);
        if (late) {
          // Record the real outcome (and release the lease), so /api/health
          // does not show "timed out" until the next slot.
          if ("error" in late) {
            this.opts.onError?.(late.error, job.name);
            await record(false, `${errMsg(late.error)} (late)`, null, true);
          } else {
            const o = late.outcome;
            await record(o.ok ?? true, null, `${o.summary} (late)`, true, o.followUpMs);
          }
        } else {
          this.log(`[scheduler] ${job.name} never settled; giving up on it in this process`);
        }
        return;
      }
      if ("error" in first) {
        this.opts.onError?.(first.error, job.name);
        await record(false, errMsg(first.error), null, true);
        return;
      }
      const o = first.outcome;
      await record(o.ok ?? true, null, o.summary, true, o.followUpMs);
    })()
      .catch((err) => this.log(`[scheduler] ${job.name}: runner error: ${errMsg(err)}`))
      .finally(() => {
        this.inflight.delete(job.name);
        if (js) js.running = false;
      });
    this.inflight.set(job.name, run);
  }
}

/** Default fallback store factory. */
export const memoryFallback = (): ClaimStore => new MemoryStore();
