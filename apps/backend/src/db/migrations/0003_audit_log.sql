CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "action" text NOT NULL,
  "target" text,
  "ip" text,
  "user_agent" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_log_user_time_idx"
  ON "audit_log" USING btree ("user_id","created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_log_action_idx"
  ON "audit_log" USING btree ("action");
