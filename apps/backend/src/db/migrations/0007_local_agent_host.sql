ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "host_mode" text DEFAULT 'box' NOT NULL;
