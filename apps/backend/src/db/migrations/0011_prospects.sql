CREATE TABLE IF NOT EXISTS "prospects" (
  "id" text PRIMARY KEY NOT NULL,
  "company" text NOT NULL,
  "contact_name" text,
  "email" text,
  "role" text,
  "source" text,
  "status" text DEFAULT 'new' NOT NULL,
  "estimated_value_eur" integer DEFAULT 0 NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "next_action_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "prospects" ADD CONSTRAINT "prospects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_status_idx" ON "prospects" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_next_action_idx" ON "prospects" ("next_action_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospects_created_idx" ON "prospects" ("created_at");
