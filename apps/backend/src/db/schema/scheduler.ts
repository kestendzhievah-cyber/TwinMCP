import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

// In-process scheduler claims (migration 0021, lib/scheduler/store.ts). The
// store queries it with raw SQL so the scheduler works before this file is
// exported from schema/index.ts; this definition keeps drizzle-kit in step.
export const schedulerRuns = pgTable("scheduler_runs", {
  job: text("job").primaryKey(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  lastFinishedAt: timestamp("last_finished_at", { withTimezone: true }),
  lastOk: boolean("last_ok"),
  lastError: text("last_error"),
  lastSummary: text("last_summary"),
  lastDurationMs: integer("last_duration_ms"),
  lastRunBy: text("last_run_by"),
  runCount: integer("run_count").notNull().default(0),
  failCount: integer("fail_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
