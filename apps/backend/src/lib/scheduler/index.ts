// In-process scheduler: runs the /api/cron/* jobs from the app container
// itself, so production needs no external cron. Started by instrumentation.ts
// (register hook) on the Node.js runtime; on by default in production,
// INTERNAL_SCHEDULER=0 turns it off, INTERNAL_SCHEDULER=1 turns it on
// elsewhere, INTERNAL_SCHEDULER_SKIP="digest,churn" skips jobs.
//
// State lives on globalThis: Next bundles instrumentation and route handlers
// separately, so a module-level variable here would be a different instance
// in /api/health than in the loop.

import { hostname } from "node:os";
import * as Sentry from "@sentry/nextjs";
import { createHash, randomBytes } from "node:crypto";
import { JOBS } from "./jobs";
import { schedulerDecision, skippedJobs } from "./enabled";
import { SchedulerRunner, emptyState, memoryFallback, type SchedulerState } from "./runner";
import { PgStore, readPersistedRows, type JobRow } from "./store";
import { describeSchedule, periodMs } from "./schedule";

export { schedulerDecision } from "./enabled";
export type { SchedulerState, JobState } from "./runner";

const KEY = Symbol.for("twinmcp.scheduler");
const TICK_MS = 30_000;
const TICK_JITTER_MS = 5_000;

interface Holder {
  state: SchedulerState;
  runner: SchedulerRunner | null;
}

function holder(): Holder {
  const g = globalThis as unknown as Record<symbol, Holder | undefined>;
  let h = g[KEY];
  if (!h) {
    h = { state: emptyState(), runner: null };
    g[KEY] = h;
  }
  return h;
}

export function getSchedulerState(): SchedulerState {
  return holder().state;
}

/**
 * Start the loop once per process. Never throws: a scheduler problem must not
 * stop the server from booting.
 */
export function startScheduler(runtime: string | undefined): SchedulerState {
  const h = holder();
  if (h.runner) return h.state;
  try {
    const decision = schedulerDecision(process.env, process.argv, runtime);
    h.state.enabled = decision.enabled;
    h.state.reason = decision.reason;
    if (!decision.enabled) {
      console.info(`[scheduler] off: ${decision.reason}`);
      return h.state;
    }
    const skip = skippedJobs(process.env);
    const jobs = JOBS.filter((j) => !skip.has(j.name));
    const instanceId = `${hostname()}:${process.pid}:${randomBytes(3).toString("hex")}`;
    const runner = new SchedulerRunner({
      jobs,
      store: new PgStore(),
      fallback: memoryFallback,
      instanceId,
      state: h.state,
      onError: (err, job) => {
        Sentry.captureException(err, { tags: { area: "scheduler", job } });
      },
    });
    h.runner = runner;

    const loop = async () => {
      await runner.tick().catch(() => undefined); // tick never throws; belt and braces
      const t = setTimeout(loop, TICK_MS + Math.round(Math.random() * TICK_JITTER_MS));
      t.unref?.();
    };
    // First tick 10–30 s after boot; each job also waits its own boot delay.
    const first = setTimeout(loop, 10_000 + Math.round(Math.random() * 20_000));
    first.unref?.();

    console.info(
      `[scheduler] on (${decision.reason}): ${jobs.map((j) => j.name).join(", ")}${skip.size ? ` — skipped: ${[...skip].join(", ")}` : ""}`
    );
  } catch (err) {
    h.state.enabled = false;
    h.state.reason = `failed to start: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[scheduler] failed to start:", err);
  }
  return h.state;
}

// ---------------------------------------------------------------------------
// /api/health
// ---------------------------------------------------------------------------

export interface SchedulerJobHealth {
  schedule: string;
  nextRunAt: string | null;
  running: boolean;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastOk: boolean | null;
  lastError: string | null;
  lastSummary: string | null;
  lastDurationMs: number | null;
  /** Short hash of the instance that ran it last (never the hostname); null when unknown. */
  lastRunBy: string | null;
  /** The last run was made by this instance. */
  mine: boolean;
  /** Listed in INTERNAL_SCHEDULER_SKIP: not run here, never reported overdue. */
  skipped: boolean;
  overdue: boolean;
}

export interface SchedulerHealth {
  enabled: boolean;
  reason: string;
  /** Short hash of this instance's id (hostname:pid:nonce stays in the server log). */
  instance: string | null;
  /** postgres = scheduler_runs claims (safe with several containers); memory = this process only. */
  coordination: "postgres" | "memory" | null;
  /** This instance holds or made the most recent claim. */
  leader: boolean;
  startedAt: string | null;
  lastTickAt: string | null;
  lastTickError: string | null;
  jobs: Record<string, SchedulerJobHealth>;
  warnings: string[];
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** /api/health is public: an instance id carries the container hostname. */
export function instanceTag(id: string | null): string | null {
  return id ? createHash("sha256").update(id).digest("hex").slice(0, 8) : null;
}

/**
 * /api/health is public: an error message may carry a host, an address, an
 * email or a token. Keep its shape, drop those, cap the length. Full errors
 * stay in the server log.
 */
export function redactError(msg: string | null): string | null {
  if (msg === null) return null;
  const out = msg
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, "<url>")
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi, "<email>")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, "<ip>")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "<redacted>");
  return out.length > 160 ? `${out.slice(0, 159)}…` : out;
}

/** Pure: merge in-process state with persisted rows (null = table unavailable). */
export function buildSchedulerHealth(
  state: SchedulerState,
  rows: JobRow[] | null,
  now: Date,
  skip: ReadonlySet<string> = new Set()
): SchedulerHealth {
  const byName = new Map((rows ?? []).map((r) => [r.job, r]));
  const jobs: Record<string, SchedulerJobHealth> = {};
  const warnings: string[] = [];
  const defs = new Map(JOBS.map((j) => [j.name, j]));
  const names = new Set([...Object.keys(state.jobs), ...byName.keys()]);

  for (const name of names) {
    const m = state.jobs[name];
    const r = byName.get(name);
    const def = defs.get(name);
    const skipped = skip.has(name);
    // Persisted rows win: they survive restarts and cover other containers.
    const nextRunAt = r?.nextRunAt ?? m?.nextRunAt ?? null;
    const running = (m?.running ?? false) || !!(r?.lockedUntil && r.lockedUntil > now);
    const overdue =
      !skipped &&
      !running &&
      !!nextRunAt &&
      !!def &&
      now.getTime() - nextRunAt.getTime() > Math.max(periodMs(def.schedule), 10 * 60_000);
    const lastOk = r ? r.lastOk : (m?.lastOk ?? null);
    const lastError = redactError(r ? r.lastError : (m?.lastError ?? null));
    const lastRunBy = r?.lastRunBy ?? (m?.runs ? state.instanceId : null);
    jobs[name] = {
      schedule: m?.schedule ?? (def ? describeSchedule(def.schedule) : "unknown"),
      nextRunAt: iso(nextRunAt),
      running,
      lastRunAt: iso(r?.lastStartedAt ?? m?.lastStartedAt),
      lastFinishedAt: iso(r?.lastFinishedAt ?? m?.lastFinishedAt),
      lastOk,
      lastError,
      lastSummary: r ? r.lastSummary : (m?.lastSummary ?? null),
      lastDurationMs: r ? r.lastDurationMs : (m?.lastDurationMs ?? null),
      lastRunBy: instanceTag(lastRunBy),
      mine: !!lastRunBy && lastRunBy === state.instanceId,
      skipped,
      overdue,
    };
    if (lastOk === false && !skipped)
      warnings.push(`${name}: last run failed${lastError ? ` (${lastError})` : ""}`);
    if (overdue && state.enabled) warnings.push(`${name}: overdue since ${iso(nextRunAt)}`);
  }

  let leader = false;
  if (state.enabled && state.instanceId) {
    if (state.coordination === "memory") {
      leader = true;
    } else if (rows && rows.length > 0) {
      const latest = [...rows].sort(
        (a, b) => (b.lastStartedAt?.getTime() ?? 0) - (a.lastStartedAt?.getTime() ?? 0)
      )[0];
      leader = (latest?.lockedBy ?? latest?.lastRunBy) === state.instanceId;
    }
  }

  if (state.enabled && state.coordination === "memory") {
    warnings.push(
      "scheduler_runs table missing (migration 0021 not applied): jobs are coordinated in this process only — a second container would run them twice"
    );
  }
  if (state.lastTickError) {
    warnings.push(`scheduler tick failing: ${redactError(state.lastTickError)}`);
  }

  return {
    enabled: state.enabled,
    reason: state.reason,
    instance: instanceTag(state.instanceId),
    coordination: state.coordination,
    leader,
    startedAt: iso(state.startedAt),
    lastTickAt: iso(state.lastTickAt),
    lastTickError: redactError(state.lastTickError),
    jobs,
    warnings,
  };
}

/** For /api/health: never throws, bounded (1 s DB read). */
export async function schedulerHealth(dbOk: boolean): Promise<SchedulerHealth> {
  const state = getSchedulerState();
  const rows = dbOk ? await readPersistedRows(1_000) : null;
  return buildSchedulerHealth(state, rows, new Date(), skippedJobs(process.env));
}
