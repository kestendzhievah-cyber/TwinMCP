CREATE TABLE IF NOT EXISTS "prospect_activities" (
  "id" text PRIMARY KEY NOT NULL,
  "prospect_id" text NOT NULL,
  "type" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospect_activities_prospect_idx" ON "prospect_activities" ("prospect_id","created_at");
