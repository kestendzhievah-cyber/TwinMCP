-- Performance Monitoring Schema Migration
-- E9-Story9-2-Monitoring-Performance

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    system JSONB NOT NULL,
    application JSONB NOT NULL,
    database JSONB NOT NULL,
    network JSONB NOT NULL,
    business JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics (created_at DESC);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    source VARCHAR(100) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    threshold JSONB NOT NULL,
    current_value DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    resolved_by VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    annotations JSONB DEFAULT '[]'::jsonb
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);
CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts (source);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_tags ON alerts USING GIN (tags);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metric VARCHAR(255) NOT NULL,
    threshold JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    source VARCHAR(100) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    cooldown INTEGER NOT NULL DEFAULT 300, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules (enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules (metric);

-- Notification channels table
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'slack', 'webhook', 'sms')),
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escalation policies table
CREATE TABLE IF NOT EXISTS escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    rules JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health checks table
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    response_time INTEGER NOT NULL, -- milliseconds
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for health checks
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks (service);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks (status);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks (timestamp DESC);

-- SLOs table
CREATE TABLE IF NOT EXISTS slos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    service VARCHAR(100) NOT NULL,
    indicator VARCHAR(255) NOT NULL,
    target DECIMAL(5,2) NOT NULL, -- percentage
    window VARCHAR(20) NOT NULL, -- e.g., "30d", "7d"
    alerting JSONB NOT NULL,
    current JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for SLOs
CREATE INDEX IF NOT EXISTS idx_slos_service ON slos (service);
CREATE INDEX IF NOT EXISTS idx_slos_indicator ON slos (indicator);

-- SLA services table
CREATE TABLE IF NOT EXISTS sla_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES sla_reports(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    availability DECIMAL(5,2) NOT NULL,
    uptime BIGINT NOT NULL, -- seconds
    downtime BIGINT NOT NULL, -- seconds
    sli JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SLA incidents table
CREATE TABLE IF NOT EXISTS sla_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sla_service_id UUID REFERENCES sla_services(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration BIGINT NOT NULL, -- seconds
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
    description TEXT,
    impact TEXT,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for SLA incidents
CREATE INDEX IF NOT EXISTS idx_sla_incidents_sla_service_id ON sla_incidents (sla_service_id);
CREATE INDEX IF NOT EXISTS idx_sla_incidents_start_time ON sla_incidents (start_time DESC);

-- SLA reports table
CREATE TABLE IF NOT EXISTS sla_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    overall_availability DECIMAL(5,2) NOT NULL,
    total_downtime BIGINT NOT NULL, -- seconds
    incidents INTEGER NOT NULL DEFAULT 0,
    mttr DECIMAL(10,2), -- Mean Time To Repair in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for SLA reports
CREATE INDEX IF NOT EXISTS idx_sla_reports_period_start ON sla_reports (period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sla_reports_period_end ON sla_reports (period_end DESC);

-- Performance dashboards table
CREATE TABLE IF NOT EXISTS performance_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    layout JSONB NOT NULL DEFAULT '{"columns": 12, "rows": 8, "gap": 16}'::jsonb,
    filters JSONB DEFAULT '[]'::jsonb,
    refresh_interval INTEGER NOT NULL DEFAULT 300, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring queries table
CREATE TABLE IF NOT EXISTS monitoring_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_monitoring_queries_category ON monitoring_queries (category);
CREATE INDEX IF NOT EXISTS idx_monitoring_queries_tags ON monitoring_queries USING GIN (tags);

-- Monitoring configuration table
CREATE TABLE IF NOT EXISTS monitoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection JSONB NOT NULL DEFAULT '{"interval": 30, "retention": 30, "batchSize": 100}'::jsonb,
    alerts JSONB NOT NULL DEFAULT '{"enabled": true, "channels": [], "escalation": []}'::jsonb,
    dashboards JSONB NOT NULL DEFAULT '{"refreshInterval": 300, "autoSave": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring stats table for quick access
CREATE TABLE IF NOT EXISTS monitoring_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_metrics BIGINT NOT NULL DEFAULT 0,
    total_alerts BIGINT NOT NULL DEFAULT 0,
    active_alerts BIGINT NOT NULL DEFAULT 0,
    healthy_services INTEGER NOT NULL DEFAULT 0,
    total_services INTEGER NOT NULL DEFAULT 0,
    uptime DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    last_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a single stats row
INSERT INTO monitoring_stats (id, created_at) 
VALUES (gen_random_uuid(), NOW()) 
ON CONFLICT DO NOTHING;

-- System resources table
CREATE TABLE IF NOT EXISTS system_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('cpu', 'memory', 'disk', 'network')),
    usage DECIMAL(5,2) NOT NULL,
    capacity BIGINT NOT NULL,
    available BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for system resources
CREATE INDEX IF NOT EXISTS idx_system_resources_name ON system_resources (name);
CREATE INDEX IF NOT EXISTS idx_system_resources_type ON system_resources (type);
CREATE INDEX IF NOT EXISTS idx_system_resources_timestamp ON system_resources (timestamp DESC);

-- Create function to update monitoring stats
CREATE OR REPLACE FUNCTION update_monitoring_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE monitoring_stats 
    SET 
        total_alerts = total_alerts + 1,
        active_alerts = active_alerts + CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
        last_update = NOW()
    WHERE id = (SELECT id FROM monitoring_stats LIMIT 1);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stats update
CREATE TRIGGER trigger_update_monitoring_stats
    AFTER INSERT ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_monitoring_stats();

-- Create function to update stats on alert resolution
CREATE OR REPLACE FUNCTION update_monitoring_stats_on_resolve()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE monitoring_stats 
    SET 
        active_alerts = GREATEST(active_alerts - 1, 0),
        last_update = NOW()
    WHERE id = (SELECT id FROM monitoring_stats LIMIT 1);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stats update on resolution
CREATE TRIGGER trigger_update_monitoring_stats_on_resolve
    AFTER UPDATE ON alerts
    FOR EACH ROW
    WHEN (OLD.status != 'resolved' AND NEW.status = 'resolved')
    EXECUTE FUNCTION update_monitoring_stats_on_resolve();

-- Create view for active alerts summary
CREATE OR REPLACE VIEW active_alerts_summary AS
SELECT 
    severity,
    COUNT(*) as count,
    MIN(created_at) as oldest_alert,
    MAX(created_at) as newest_alert
FROM alerts 
WHERE status = 'active'
GROUP BY severity
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
    END;

-- Create view for service health status
CREATE OR REPLACE VIEW service_health_status AS
SELECT 
    service,
    status,
    response_time,
    timestamp as last_check,
    CASE 
        WHEN timestamp > NOW() - INTERVAL '5 minutes' THEN 'recent'
        WHEN timestamp > NOW() - INTERVAL '15 minutes' THEN 'stale'
        ELSE 'very_stale'
    END as freshness
FROM health_checks h1
WHERE timestamp = (
    SELECT MAX(timestamp) 
    FROM health_checks h2 
    WHERE h2.service = h1.service
);

-- Create view for metrics summary
CREATE OR REPLACE VIEW metrics_summary AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    AVG((system::jsonb->'cpu'->>'usage')::DECIMAL) as avg_cpu_usage,
    AVG((system::jsonb->'memory'->>'used')::DECIMAL / (system::jsonb->'memory'->>'total')::DECIMAL * 100) as avg_memory_usage,
    AVG(application::jsonb->'requests'->>'averageLatency')::DECIMAL as avg_response_time,
    SUM(application::jsonb->'requests'->>'total')::BIGINT as total_requests,
    SUM(application::jsonb->'errors'->>'total')::BIGINT as total_errors
FROM performance_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- Add comments for documentation
COMMENT ON TABLE performance_metrics IS 'Stores system, application, database, network, and business metrics collected at regular intervals';
COMMENT ON TABLE alerts IS 'Stores alert instances generated when thresholds are breached';
COMMENT ON TABLE alert_rules IS 'Defines rules for when alerts should be triggered';
COMMENT ON TABLE notification_channels IS 'Configuration for different notification channels (email, Slack, webhook, SMS)';
COMMENT ON TABLE escalation_policies IS 'Defines escalation policies for alerts';
COMMENT ON TABLE health_checks IS 'Results of health checks performed on various services';
COMMENT ON TABLE slos IS 'Service Level Objectives definitions and current status';
COMMENT ON TABLE sla_reports IS 'Service Level Agreement reports with availability metrics';
COMMENT ON TABLE sla_services IS 'Individual service metrics within SLA reports';
COMMENT ON TABLE sla_incidents IS 'Incidents that affected service availability';
COMMENT ON TABLE performance_dashboards IS 'Dashboard configurations for monitoring visualizations';
COMMENT ON TABLE monitoring_queries IS 'Predefined queries for monitoring dashboards';
COMMENT ON TABLE monitoring_config IS 'Global configuration for the monitoring system';
COMMENT ON TABLE monitoring_stats IS 'Aggregated statistics for quick overview';
COMMENT ON TABLE system_resources IS 'Current system resource utilization';

-- Create indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_performance_metrics_system_cpu ON performance_metrics USING GIN ((system->'cpu'));
CREATE INDEX IF NOT EXISTS idx_performance_metrics_application_requests ON performance_metrics USING GIN ((application->'requests'));
CREATE INDEX IF NOT EXISTS idx_performance_metrics_database_connections ON performance_metrics USING GIN ((database->'connections'));
CREATE INDEX IF NOT EXISTS idx_alerts_threshold ON alerts USING GIN (threshold);
CREATE INDEX IF NOT EXISTS idx_alert_rules_threshold ON alert_rules USING GIN (threshold);
