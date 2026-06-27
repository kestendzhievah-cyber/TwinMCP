CREATE UNIQUE INDEX IF NOT EXISTS "usage_metrics_us_period_unique" ON "usage_metrics" ("user_server_id","period_start");
