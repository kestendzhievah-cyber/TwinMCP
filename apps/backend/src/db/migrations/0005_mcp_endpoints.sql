ALTER TABLE "user_servers" ADD COLUMN IF NOT EXISTS "endpoint_url" text;
ALTER TABLE "user_servers" ADD COLUMN IF NOT EXISTS "bridge_port" integer;
ALTER TABLE "user_servers" ADD COLUMN IF NOT EXISTS "endpoint_token_ciphertext" text DEFAULT '' NOT NULL;
ALTER TABLE "user_servers" ADD COLUMN IF NOT EXISTS "endpoint_token_iv" text DEFAULT '' NOT NULL;
ALTER TABLE "user_servers" ADD COLUMN IF NOT EXISTS "endpoint_token_tag" text DEFAULT '' NOT NULL;
