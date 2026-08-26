CREATE INDEX IF NOT EXISTS "usage_time_idx" ON "usage_events" ("timestamp");
CREATE INDEX IF NOT EXISTS "usage_metrics_period_idx" ON "usage_metrics" ("period_start");
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" ("created_at");
