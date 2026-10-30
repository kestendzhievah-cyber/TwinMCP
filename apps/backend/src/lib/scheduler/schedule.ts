// Pure scheduling math for the in-process scheduler (no I/O, no clock reads).
// Every time is UTC; slots are aligned to the Unix epoch, which is aligned to
// midnight UTC, so "every 5 minutes" fires at :00, :05, :10… of every hour.

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type Schedule =
  /** Every `minutes` minutes, `offsetMinutes` after each aligned slot (e.g. */
  /** every 10 with offset 2 → :02, :12, :22…; every 60 with offset 17 → hh:17). */
  | { kind: "every"; minutes: number; offsetMinutes?: number }
  /** Once a day at hour:minute UTC. */
  | { kind: "daily"; hour: number; minute: number };

/** Throws on a schedule that could never fire, or that the slot math does not support. */
export function assertValidSchedule(s: Schedule): void {
  if (s.kind === "every") {
    const off = s.offsetMinutes ?? 0;
    if (!Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 1440) {
      throw new Error(`every: minutes must be an integer in 1..1440 (got ${s.minutes})`);
    }
    // Slots stay aligned to the hour/day only when the period divides a day.
    if (1440 % s.minutes !== 0) {
      throw new Error(`every: ${s.minutes} does not divide 1440 (slots would drift)`);
    }
    if (!Number.isInteger(off) || off < 0 || off >= s.minutes) {
      throw new Error(`every: offsetMinutes must be an integer in 0..${s.minutes - 1}`);
    }
    return;
  }
  if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) {
    throw new Error(`daily: hour must be an integer in 0..23 (got ${s.hour})`);
  }
  if (!Number.isInteger(s.minute) || s.minute < 0 || s.minute > 59) {
    throw new Error(`daily: minute must be an integer in 0..59 (got ${s.minute})`);
  }
}

/** Nominal period of a schedule, in ms. */
export function periodMs(s: Schedule): number {
  return s.kind === "every" ? s.minutes * MINUTE_MS : DAY_MS;
}

/** The first slot STRICTLY after `after`. */
export function nextRunAfter(s: Schedule, after: Date): Date {
  const t = after.getTime();
  if (s.kind === "every") {
    const step = s.minutes * MINUTE_MS;
    const off = (s.offsetMinutes ?? 0) * MINUTE_MS;
    const k = Math.floor((t - off) / step) + 1;
    return new Date(k * step + off);
  }
  const d = new Date(t);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), s.hour, s.minute);
  return new Date(today > t ? today : today + DAY_MS);
}

/**
 * The next slot to store after a run claimed at `claimedAt`. A small margin
 * keeps a claim made a few ms before a slot boundary (clock skew between the
 * app and the database) from storing that same boundary and re-running at the
 * next tick.
 */
export function nextAfterClaim(s: Schedule, claimedAt: Date, marginMs = 2_000): Date {
  return nextRunAfter(s, new Date(claimedAt.getTime() + marginMs));
}

/**
 * Whether a stored next-run time is impossible for this schedule: later than
 * the next slot after `now`. That happens only when the schedule changed in
 * code (e.g. daily → hourly) or a clock jumped; the caller then resets it to
 * nextRunAfter(s, now) instead of waiting for the stale far-future slot.
 */
export function isStoredNextStale(s: Schedule, storedNext: Date, now: Date): boolean {
  return storedNext.getTime() > nextRunAfter(s, now).getTime();
}

/** Human-readable, for logs and /api/health: "every 5 min", "every 10 min +2", "daily 08:00 UTC". */
export function describeSchedule(s: Schedule): string {
  if (s.kind === "daily") {
    const hh = String(s.hour).padStart(2, "0");
    const mm = String(s.minute).padStart(2, "0");
    return `daily ${hh}:${mm} UTC`;
  }
  const off = s.offsetMinutes ?? 0;
  if (s.minutes === 60) return `hourly at :${String(off).padStart(2, "0")}`;
  return off ? `every ${s.minutes} min +${off}` : `every ${s.minutes} min`;
}

/**
 * Boot delay before a job may run in this process: `baseMs` plus a random
 * spread, so a restart after downtime (every job overdue) does not fire all
 * jobs in the same second. `random` is injectable for tests.
 */
export function bootDelayMs(baseMs: number, spreadMs: number, random: () => number): number {
  const r = Math.min(Math.max(random(), 0), 1);
  return Math.round(baseMs + r * spreadMs);
}
