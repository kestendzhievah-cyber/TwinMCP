-- OAuth 2.1 for remote MCP connectors (contract D4). Codes and tokens are
-- stored as SHA-256 hashes only. Hand-written and idempotent.
CREATE TABLE IF NOT EXISTS "oauth_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" text NOT NULL,
  "client_name" text NOT NULL,
  "redirect_uris" text[] DEFAULT '{}'::text[] NOT NULL,
  "client_uri" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_clients_client_id_idx" ON "oauth_clients" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_created_idx" ON "oauth_clients" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_hash" text NOT NULL,
  "client_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "server_id" text,
  "redirect_uri" text NOT NULL,
  "code_challenge" text NOT NULL,
  "scope" text DEFAULT 'mcp' NOT NULL,
  "resource" text,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "family_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_codes_hash_idx" ON "oauth_codes" ("code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_codes_expires_idx" ON "oauth_codes" ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "family_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "server_id" text,
  "access_token_hash" text NOT NULL,
  "refresh_token_hash" text NOT NULL,
  "scope" text DEFAULT 'mcp' NOT NULL,
  "resource" text,
  "access_expires_at" timestamp with time zone NOT NULL,
  "refresh_expires_at" timestamp with time zone NOT NULL,
  "authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_tokens_access_hash_idx" ON "oauth_tokens" ("access_token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_tokens_refresh_hash_idx" ON "oauth_tokens" ("refresh_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_tokens_family_idx" ON "oauth_tokens" ("family_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_tokens_user_idx" ON "oauth_tokens" ("user_id");
