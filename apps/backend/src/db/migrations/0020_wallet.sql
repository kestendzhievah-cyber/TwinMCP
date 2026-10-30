CREATE TABLE IF NOT EXISTS "wallet_accounts" (
  "user_id" text PRIMARY KEY NOT NULL,
  "paid_micros" bigint DEFAULT 0 NOT NULL,
  "promo_micros" bigint DEFAULT 0 NOT NULL,
  "promo_expires_at" timestamp with time zone,
  "auto_recharge_enabled" boolean DEFAULT false NOT NULL,
  "auto_recharge_threshold_micros" bigint DEFAULT 5000000 NOT NULL,
  "auto_recharge_amount_micros" bigint DEFAULT 20000000 NOT NULL,
  "auto_recharge_monthly_cap_micros" bigint DEFAULT 100000000 NOT NULL,
  "stripe_payment_method_id" text,
  "funded_at" timestamp with time zone,
  "zero_balance_at" timestamp with time zone,
  "notified" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_promo_nonneg" CHECK ("promo_micros" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- user_id is nullable and SET NULL on user delete: the ledger is the
-- accounting journal (top-ups, VAT evidence, clawbacks) and must outlive a
-- closed account. The id stays an opaque key once the user row is gone.
CREATE TABLE IF NOT EXISTS "credit_ledger" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
  "user_id" text,
  "delta_micros" bigint NOT NULL,
  "bucket" text NOT NULL,
  "kind" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "balance_after_micros" bigint NOT NULL,
  "stripe_ref" text,
  "units" jsonb,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_idempotency_key_unique" UNIQUE ("idempotency_key");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_bucket_check" CHECK ("bucket" IN ('paid', 'promo'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_user_created_idx" ON "credit_ledger" ("user_id","created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "box_usage_snapshots" (
  "box_id" text PRIMARY KEY NOT NULL,
  "server_id" text,
  "user_id" text,
  "total_cost_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
  "total_cpu_ns" bigint DEFAULT 0 NOT NULL,
  "sampled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signup_credit_claims" (
  "email_hash" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "ip_prefix" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signup_credit_claims_ip_created_idx" ON "signup_credit_claims" ("ip_prefix","created_at");
