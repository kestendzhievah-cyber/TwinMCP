CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"repo_url" text,
	"runtime" text NOT NULL,
	"install_cmd" text NOT NULL,
	"start_cmd" text NOT NULL,
	"version" text DEFAULT 'latest' NOT NULL,
	"config_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_by_user_id" text,
	"is_official" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"host_type" text DEFAULT 'upstash_box' NOT NULL,
	"box_id" text,
	"box_size" text DEFAULT 'small' NOT NULL,
	"region" text,
	"endpoint_url" text,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_server_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server_id" text NOT NULL,
	"mcp_server_id" text NOT NULL,
	"config_ciphertext" text DEFAULT '' NOT NULL,
	"config_iv" text DEFAULT '' NOT NULL,
	"config_tag" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_user_server_id_user_servers_id_fk" FOREIGN KEY ("user_server_id") REFERENCES "public"."user_servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_time_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_servers_slug_idx" ON "mcp_servers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_servers_published_idx" ON "mcp_servers" USING btree ("published_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_servers_public_idx" ON "mcp_servers" USING btree ("is_public");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "servers_user_slug_idx" ON "servers" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "servers_user_idx" ON "servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "servers_status_idx" ON "servers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_metrics_us_period_idx" ON "usage_metrics" USING btree ("user_server_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_servers_server_mcp_idx" ON "user_servers" USING btree ("server_id","mcp_server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_servers_user_idx" ON "user_servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_servers_server_idx" ON "user_servers" USING btree ("server_id");