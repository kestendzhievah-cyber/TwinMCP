CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "url" text NOT NULL,
  "secret_encrypted" text NOT NULL,
  "events" text[] DEFAULT '{}'::text[] NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_success_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "failure_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_endpoints_user_idx" ON "webhook_endpoints" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "endpoint_id" text NOT NULL,
  "event_type" text NOT NULL,
  "event_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "response_code" integer,
  "attempt" integer DEFAULT 0 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "next_attempt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_created_idx" ON "webhook_deliveries" ("endpoint_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_due_idx" ON "webhook_deliveries" ("status","next_attempt_at");
