-- In-process scheduler claims (lib/scheduler/store.ts PgStore). One row per
-- job: a run is claimed with an atomic UPDATE ... WHERE next_run_at <= now()
-- AND the lease is free, so several processes or containers never run the
-- same slot twice. Holds no secret and no personal data (counts only in
-- last_summary). Idempotent.
CREATE TABLE IF NOT EXISTS "scheduler_runs" (
  "job" text PRIMARY KEY NOT NULL,
  "next_run_at" timestamp with time zone NOT NULL,
  "locked_until" timestamp with time zone,
  "locked_by" text,
  "last_started_at" timestamp with time zone,
  "last_finished_at" timestamp with time zone,
  "last_ok" boolean,
  "last_error" text,
  "last_summary" text,
  "last_duration_ms" integer,
  "last_run_by" text,
  "run_count" integer DEFAULT 0 NOT NULL,
  "fail_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
