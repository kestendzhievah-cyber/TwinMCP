-- Per-installation tool access policy (D2). Null = all tools allowed.
-- Shape: { "mode": "all" | "read_only" | "allow_list", "allow"?: string[], "deny"?: string[] }
ALTER TABLE "user_servers" ADD COLUMN IF NOT EXISTS "tool_policy" jsonb;
