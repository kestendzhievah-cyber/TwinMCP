-- Add description column to external_mcp_servers table
ALTER TABLE external_mcp_servers ADD COLUMN IF NOT EXISTS description TEXT;
