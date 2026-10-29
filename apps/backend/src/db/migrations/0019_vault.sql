CREATE TABLE IF NOT EXISTS "user_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "value_encrypted" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_secrets" ADD CONSTRAINT "user_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_secrets_user_name_idx" ON "user_secrets" ("user_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_secrets_user_idx" ON "user_secrets" ("user_id");
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "external_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_external_idx" ON "api_keys" ("user_id","external_user_id");
