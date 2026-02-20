-- Migration: Add External MCP Server tables (Story 10.12)
-- Run with: psql $DATABASE_URL -f prisma/migrations/add_external_mcp_tables.sql

-- Enum types
DO $$ BEGIN
  CREATE TYPE "ExternalMcpAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER', 'BASIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExternalMcpStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- External MCP Servers table
CREATE TABLE IF NOT EXISTS "external_mcp_servers" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"             TEXT NOT NULL,
  "baseUrl"          TEXT NOT NULL,
  "authType"         "ExternalMcpAuthType" NOT NULL DEFAULT 'NONE',
  "encryptedSecret"  TEXT,
  "status"           "ExternalMcpStatus" NOT NULL DEFAULT 'UNKNOWN',
  "errorMessage"     TEXT,
  "lastCheckedAt"    TIMESTAMP(3),
  "lastLatencyMs"    INTEGER,
  "toolsDiscovered"  JSONB,
  "ownerId"          TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "external_mcp_servers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_mcp_servers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint: one name per owner
CREATE UNIQUE INDEX IF NOT EXISTS "external_mcp_servers_ownerId_name_key"
  ON "external_mcp_servers"("ownerId", "name");

-- External MCP Usage Logs table
CREATE TABLE IF NOT EXISTS "external_mcp_usage_logs" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "serverId"   TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "toolName"   TEXT,
  "statusCode" INTEGER,
  "latencyMs"  INTEGER,
  "tokensIn"   INTEGER,
  "tokensOut"  INTEGER,
  "success"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "external_mcp_usage_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_mcp_usage_logs_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "external_mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS "external_mcp_usage_logs_userId_createdAt_idx"
  ON "external_mcp_usage_logs"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "external_mcp_usage_logs_serverId_createdAt_idx"
  ON "external_mcp_usage_logs"("serverId", "createdAt");
