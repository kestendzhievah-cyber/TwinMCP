-- Migration: Add performance indexes for API key usage analytics
-- These indexes support the per-key usage history and analytics queries

-- Index for date-grouped aggregation on usage_logs (used by getKeyUsageHistory)
CREATE INDEX IF NOT EXISTS idx_usage_logs_apikey_created_date
  ON usage_logs (api_key_id, created_at DESC);

-- Index for success rate calculation by key
CREATE INDEX IF NOT EXISTS idx_usage_logs_apikey_success
  ON usage_logs (api_key_id, success);

-- Index for recent errors query
CREATE INDEX IF NOT EXISTS idx_usage_logs_apikey_errors
  ON usage_logs (api_key_id, created_at DESC)
  WHERE success = false;

-- Index for API key expiration queries (finding expired keys)
CREATE INDEX IF NOT EXISTS idx_api_keys_expires
  ON api_keys (expires_at)
  WHERE is_active = true AND revoked_at IS NULL AND expires_at IS NOT NULL;
