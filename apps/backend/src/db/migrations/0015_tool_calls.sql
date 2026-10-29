-- Tool-call activity log (contract D1). Metadata only: no arguments, no results.
-- Hand-written and idempotent (IF NOT EXISTS / duplicate_object guards).
CREATE TABLE IF NOT EXISTS "tool_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "server_id" text NOT NULL,
  "user_server_id" text,
  "mcp_slug" text NOT NULL,
  "tool_name" text,
  "status" text NOT NULL,
  "error_code" integer,
  "latency_ms" integer,
  "request_id" text NOT NULL,
  "api_key_id" text,
  "external_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_user_server_id_user_servers_id_fk" FOREIGN KEY ("user_server_id") REFERENCES "user_servers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_calls_user_time_idx" ON "tool_calls" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_calls_server_time_idx" ON "tool_calls" ("server_id", "created_at" DESC);
--> statement-breakpoint
-- Retention purge (lib/activity/purge.ts) filters on created_at alone.
CREATE INDEX IF NOT EXISTS "tool_calls_created_idx" ON "tool_calls" ("created_at");
