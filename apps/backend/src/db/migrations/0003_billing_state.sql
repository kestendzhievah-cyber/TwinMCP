ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_idx"
  ON "users" USING btree ("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;
