// Claim stores for the scheduler: who runs a due job, exactly once per slot.
//
// PgStore (scheduler_runs, migration 0021) is the coordination across
// processes and containers. A claim is one atomic UPDATE … WHERE
// next_run_at <= now() AND the lease is free … RETURNING: under READ
// COMMITTED a concurrent claimer re-checks the WHERE on the updated row and
// loses. It holds no connection while the job runs, so it works through the
// Supabase pooler in transaction mode (where session advisory locks do not:
// the lock would stay on whichever backend served the statement). A crashed
// runner's lease simply expires.
//
// MemoryStore is the fallback while the table does not exist (migration not
// applied yet): the same semantics within this process only, which is enough
// for the single production container.

import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export interface JobRow {
  job: string;
  nextRunAt: Date;
  lockedUntil: Date | null;
  lockedBy: string | null;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastOk: boolean | null;
  lastError: string | null;
  lastSummary: string | null;
  lastDurationMs: number | null;
  lastRunBy: string | null;
  runCount: number;
  failCount: number;
}

export interface FinishInput {
  ok: boolean;
  error: string | null;
  summary: string | null;
  durationMs: number;
  /** Release the lease (false on a timeout: the work may still be running). */
  release: boolean;
  /** Pull the next run earlier (batched work left over). */
  followUpAt?: Date;
}

export interface ClaimStore {
  readonly kind: "postgres" | "memory";
  /** Create missing rows with their first slot. Existing rows are left alone. */
  ensure(jobs: { name: string; nextRunAt: Date }[]): Promise<void>;
  /** All rows plus the store's clock (the database's now() for PgStore). */
  list(): Promise<{ now: Date; rows: JobRow[] }>;
  /** Atomically claim a due, unleased job; true when this caller won it. */
  claim(job: string, nextRunAt: Date, leaseMs: number, by: string): Promise<boolean>;
  /**
   * Atomically re-claim an abandoned run (see isAbandonedRun) without moving
   * next_run_at; true when this caller won it. Optional: a store without it
   * simply never retries an abandoned slot.
   */
  claimAbandoned?(job: string, leaseMs: number, by: string): Promise<boolean>;
  finish(job: string, by: string, r: FinishInput): Promise<void>;
  /** Release the lease if still ours (a timed-out run that settled late). */
  release(job: string, by: string): Promise<void>;
  resetNext(job: string, nextRunAt: Date): Promise<void>;
}

const ERROR_MAX = 500;

/**
 * A run that was claimed but never recorded: its lease expired while still
 * held (locked_by set) and it has no finish after its start. That is a crash
 * or a redeploy (SIGTERM, no drain) mid-run. A timed-out run records a finish,
 * so it is not abandoned. Only a run started within the last `withinMs` (one
 * period of the job) is retried; an older one is left to the normal schedule.
 */
export function isAbandonedRun(
  r: Pick<JobRow, "lockedBy" | "lockedUntil" | "lastStartedAt" | "lastFinishedAt">,
  now: Date,
  withinMs: number
): boolean {
  if (!r.lockedBy || !r.lockedUntil || !r.lastStartedAt) return false;
  if (r.lockedUntil.getTime() > now.getTime()) return false;
  if (r.lastFinishedAt && r.lastFinishedAt.getTime() >= r.lastStartedAt.getTime()) return false;
  return now.getTime() - r.lastStartedAt.getTime() < withinMs;
}

export function truncate(s: string | null, max = ERROR_MAX): string | null {
  if (s === null) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export class MemoryStore implements ClaimStore {
  readonly kind = "memory" as const;
  private rows = new Map<string, JobRow>();
  constructor(private clock: () => Date = () => new Date()) {}

  async ensure(jobs: { name: string; nextRunAt: Date }[]): Promise<void> {
    for (const j of jobs) {
      if (this.rows.has(j.name)) continue;
      this.rows.set(j.name, {
        job: j.name,
        nextRunAt: j.nextRunAt,
        lockedUntil: null,
        lockedBy: null,
        lastStartedAt: null,
        lastFinishedAt: null,
        lastOk: null,
        lastError: null,
        lastSummary: null,
        lastDurationMs: null,
        lastRunBy: null,
        runCount: 0,
        failCount: 0,
      });
    }
  }

  async list(): Promise<{ now: Date; rows: JobRow[] }> {
    return { now: this.clock(), rows: [...this.rows.values()].map((r) => ({ ...r })) };
  }

  async claim(job: string, nextRunAt: Date, leaseMs: number, by: string): Promise<boolean> {
    const r = this.rows.get(job);
    const now = this.clock();
    if (!r || r.nextRunAt.getTime() > now.getTime()) return false;
    if (r.lockedUntil && r.lockedUntil.getTime() > now.getTime()) return false;
    r.nextRunAt = nextRunAt;
    r.lockedUntil = new Date(now.getTime() + leaseMs);
    r.lockedBy = by;
    r.lastStartedAt = now;
    return true;
  }

  async claimAbandoned(job: string, leaseMs: number, by: string): Promise<boolean> {
    const r = this.rows.get(job);
    const now = this.clock();
    if (!r || !isAbandonedRun(r, now, Number.POSITIVE_INFINITY)) return false;
    r.lockedUntil = new Date(now.getTime() + leaseMs);
    r.lockedBy = by;
    r.lastStartedAt = now;
    return true;
  }

  async finish(job: string, by: string, f: FinishInput): Promise<void> {
    const r = this.rows.get(job);
    if (!r) return;
    const now = this.clock();
    if (f.release && r.lockedBy === by) {
      r.lockedUntil = null;
      r.lockedBy = null;
    }
    r.lastFinishedAt = now;
    r.lastOk = f.ok;
    r.lastError = truncate(f.error);
    r.lastSummary = truncate(f.summary);
    r.lastDurationMs = f.durationMs;
    r.lastRunBy = by;
    r.runCount += 1;
    if (!f.ok) r.failCount += 1;
    if (f.followUpAt && f.followUpAt.getTime() < r.nextRunAt.getTime()) r.nextRunAt = f.followUpAt;
  }

  async release(job: string, by: string): Promise<void> {
    const r = this.rows.get(job);
    if (r && r.lockedBy === by) {
      r.lockedUntil = null;
      r.lockedBy = null;
    }
  }

  async resetNext(job: string, nextRunAt: Date): Promise<void> {
    const r = this.rows.get(job);
    if (r) r.nextRunAt = nextRunAt;
  }
}

// ---------------------------------------------------------------------------
// Postgres (scheduler_runs)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;

const toDate = (v: unknown): Date | null =>
  v === null || v === undefined ? null : v instanceof Date ? v : new Date(String(v));

function toRow(r: Raw): JobRow {
  return {
    job: String(r.job),
    nextRunAt: toDate(r.next_run_at) ?? new Date(0),
    lockedUntil: toDate(r.locked_until),
    lockedBy: (r.locked_by as string | null) ?? null,
    lastStartedAt: toDate(r.last_started_at),
    lastFinishedAt: toDate(r.last_finished_at),
    lastOk: (r.last_ok as boolean | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    lastSummary: (r.last_summary as string | null) ?? null,
    lastDurationMs: r.last_duration_ms === null ? null : Number(r.last_duration_ms),
    lastRunBy: (r.last_run_by as string | null) ?? null,
    runCount: Number(r.run_count ?? 0),
    failCount: Number(r.fail_count ?? 0),
  };
}

/** Postgres "undefined_table": scheduler_runs does not exist (0021 not applied). */
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

export class PgStore implements ClaimStore {
  readonly kind = "postgres" as const;

  async ensure(jobs: { name: string; nextRunAt: Date }[]): Promise<void> {
    const db = getDb();
    for (const j of jobs) {
      await db.execute(sql`
        insert into scheduler_runs (job, next_run_at)
        values (${j.name}, ${j.nextRunAt.toISOString()}::timestamptz)
        on conflict (job) do nothing
      `);
    }
  }

  async list(): Promise<{ now: Date; rows: JobRow[] }> {
    const db = getDb();
    const [clock] = await db.execute(sql`select now() as now`);
    const rows = await db.execute(sql`select * from scheduler_runs`);
    return {
      now: toDate((clock as Raw | undefined)?.now) ?? new Date(),
      rows: (rows as unknown as Raw[]).map(toRow),
    };
  }

  async claim(job: string, nextRunAt: Date, leaseMs: number, by: string): Promise<boolean> {
    const rows = await getDb().execute(sql`
      update scheduler_runs set
        next_run_at = ${nextRunAt.toISOString()}::timestamptz,
        locked_until = now() + (${Math.round(leaseMs)}::int * interval '1 millisecond'),
        locked_by = ${by},
        last_started_at = now(),
        updated_at = now()
      where job = ${job}
        and next_run_at <= now()
        and (locked_until is null or locked_until <= now())
      returning job
    `);
    return rows.length > 0;
  }

  async claimAbandoned(job: string, leaseMs: number, by: string): Promise<boolean> {
    // Same conditions as isAbandonedRun, on the database clock; the lease
    // check makes it a compare-and-swap between claimers.
    const rows = await getDb().execute(sql`
      update scheduler_runs set
        locked_until = now() + (${Math.round(leaseMs)}::int * interval '1 millisecond'),
        locked_by = ${by},
        last_started_at = now(),
        updated_at = now()
      where job = ${job}
        and locked_by is not null
        and locked_until is not null
        and locked_until <= now()
        and last_started_at is not null
        and (last_finished_at is null or last_finished_at < last_started_at)
      returning job
    `);
    return rows.length > 0;
  }

  async finish(job: string, by: string, f: FinishInput): Promise<void> {
    const followUp = f.followUpAt ? f.followUpAt.toISOString() : null;
    // The lease is cleared only if still ours (it may have expired and been
    // re-claimed by another instance after a timeout).
    await getDb().execute(sql`
      update scheduler_runs set
        locked_until = case when ${f.release}::boolean and locked_by = ${by} then null else locked_until end,
        locked_by = case when ${f.release}::boolean and locked_by = ${by} then null else locked_by end,
        last_finished_at = now(),
        last_ok = ${f.ok}::boolean,
        last_error = ${truncate(f.error)}::text,
        last_summary = ${truncate(f.summary)}::text,
        last_duration_ms = ${Math.round(f.durationMs)}::int,
        last_run_by = ${by},
        run_count = run_count + 1,
        fail_count = fail_count + ${f.ok ? 0 : 1}::int,
        next_run_at = least(next_run_at, coalesce(${followUp}::timestamptz, next_run_at)),
        updated_at = now()
      where job = ${job}
    `);
  }

  async release(job: string, by: string): Promise<void> {
    await getDb().execute(sql`
      update scheduler_runs
      set locked_until = null, locked_by = null, updated_at = now()
      where job = ${job} and locked_by = ${by}
    `);
  }

  async resetNext(job: string, nextRunAt: Date): Promise<void> {
    await getDb().execute(sql`
      update scheduler_runs
      set next_run_at = ${nextRunAt.toISOString()}::timestamptz, updated_at = now()
      where job = ${job}
    `);
  }
}

/** Rows of scheduler_runs for /api/health, bounded; null if the table is missing or the DB slow. */
export async function readPersistedRows(timeoutMs = 1_000): Promise<JobRow[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rows = await Promise.race([
      getDb().execute(sql`select * from scheduler_runs`),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return (rows as unknown as Raw[]).map(toRow);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
