-- Migration: Add Analytics Schema
-- Description: Add tables for analytics system including sessions, events, funnels, conversions, and patterns

-- Sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in milliseconds
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    os VARCHAR(100),
    os_version VARCHAR(50),
    device VARCHAR(100),
    screen_resolution VARCHAR(20),
    viewport VARCHAR(20),
    language VARCHAR(10),
    timezone VARCHAR(50),
    country VARCHAR(50),
    region VARCHAR(50),
    city VARCHAR(100),
    isp VARCHAR(100),
    browser_name VARCHAR(50),
    browser_version VARCHAR(50),
    browser_engine VARCHAR(50),
    cookies_enabled BOOLEAN DEFAULT true,
    javascript_enabled BOOLEAN DEFAULT true,
    do_not_track BOOLEAN DEFAULT false,
    referrer TEXT,
    landing_page TEXT,
    exit_page TEXT,
    page_views INTEGER DEFAULT 0,
    bounce BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_start_time (start_time),
    INDEX idx_sessions_device_type (device_type),
    INDEX idx_sessions_country (country),
    INDEX idx_sessions_created_at (created_at)
);

-- Session events table for tracking individual events
CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    label TEXT,
    value DECIMAL(10,2),
    properties JSONB DEFAULT '{}',
    page_url TEXT,
    page_title TEXT,
    page_path TEXT,
    page_search TEXT,
    page_hash TEXT,
    user_id TEXT NOT NULL,
    is_new_user BOOLEAN DEFAULT false,
    is_new_session BOOLEAN DEFAULT false,
    user_properties JSONB DEFAULT '{}',
    session_properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_session_events_session_id (session_id),
    INDEX idx_session_events_user_id (user_id),
    INDEX idx_session_events_timestamp (timestamp),
    INDEX idx_session_events_event_type (event_type),
    INDEX idx_session_events_event_category (event_category),
    INDEX idx_session_events_created_at (created_at),
    
    -- GIN index for JSONB properties
    INDEX idx_session_events_properties_gin (properties USING GIN)
);

-- Funnel definitions
CREATE TABLE IF NOT EXISTS funnels (
    id TEXT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL, -- Array of funnel steps
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_funnels_is_active (is_active),
    INDEX idx_funnels_created_at (created_at)
);

-- Funnel performance tracking
CREATE TABLE IF NOT EXISTS funnel_analytics (
    id TEXT PRIMARY KEY,
    funnel_id TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_users INTEGER DEFAULT 0,
    step_analytics JSONB NOT NULL, -- Analytics for each step
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    average_time INTEGER DEFAULT 0, -- in milliseconds
    drop_off_points JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_funnel_analytics_funnel_id (funnel_id),
    INDEX idx_funnel_analytics_period (period_start, period_end),
    INDEX idx_funnel_analytics_created_at (created_at)
);

-- Conversion types
CREATE TABLE IF NOT EXISTS conversion_types (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    value DECIMAL(10,2) DEFAULT 0,
    category VARCHAR(50) CHECK (category IN ('signup', 'subscription', 'upgrade', 'referral', 'engagement')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_conversion_types_category (category),
    INDEX idx_conversion_types_is_active (is_active)
);

-- Conversions tracking
CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    conversion_type_id TEXT NOT NULL REFERENCES conversion_types(id),
    user_id TEXT NOT NULL,
    session_id TEXT REFERENCES sessions(id),
    value DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    properties JSONB DEFAULT '{}',
    attribution_source VARCHAR(100),
    attribution_medium VARCHAR(100),
    attribution_campaign VARCHAR(100),
    attribution_term VARCHAR(100),
    attribution_content VARCHAR(100),
    touchpoints JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_conversions_conversion_type_id (conversion_type_id),
    INDEX idx_conversions_user_id (user_id),
    INDEX idx_conversions_session_id (session_id),
    INDEX idx_conversions_timestamp (timestamp),
    INDEX idx_conversions_created_at (created_at)
);

-- Behavior patterns
CREATE TABLE IF NOT EXISTS behavior_patterns (
    id TEXT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    pattern_type VARCHAR(50) CHECK (pattern_type IN ('usage', 'engagement', 'retention', 'churn', 'conversion')),
    pattern_definition JSONB NOT NULL,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    frequency INTEGER DEFAULT 0,
    impact VARCHAR(20) CHECK (impact IN ('low', 'medium', 'high')),
    recommendations JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_behavior_patterns_pattern_type (pattern_type),
    INDEX idx_behavior_patterns_confidence (confidence),
    INDEX idx_behavior_patterns_is_active (is_active),
    INDEX idx_behavior_patterns_created_at (created_at)
);

-- Pattern occurrences
CREATE TABLE IF NOT EXISTS pattern_occurrences (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL REFERENCES behavior_patterns(id) ON DELETE CASCADE,
    user_id TEXT,
    session_id TEXT REFERENCES sessions(id),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_pattern_occurrences_pattern_id (pattern_id),
    INDEX idx_pattern_occurrences_user_id (user_id),
    INDEX idx_pattern_occurrences_detected_at (detected_at),
    INDEX idx_pattern_occurrences_created_at (created_at)
);

-- Analytics insights
CREATE TABLE IF NOT EXISTS analytics_insights (
    id TEXT PRIMARY KEY,
    insight_type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')),
    user_id TEXT, -- NULL for global insights
    period_start DATE,
    period_end DATE,
    recommendations JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_analytics_insights_insight_type (insight_type),
    INDEX idx_analytics_insights_user_id (user_id),
    INDEX idx_analytics_insights_severity (severity),
    INDEX idx_analytics_insights_is_read (is_read),
    INDEX idx_analytics_insights_is_resolved (is_resolved),
    INDEX idx_analytics_insights_created_at (created_at)
);

-- Dashboard configurations
CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    user_id TEXT, -- NULL for system dashboards
    widgets JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_dashboards_user_id (user_id),
    INDEX idx_dashboards_is_public (is_public),
    INDEX idx_dashboards_is_active (is_active),
    INDEX idx_dashboards_created_at (created_at)
);

-- Analytics reports
CREATE TABLE IF NOT EXISTS analytics_reports (
    id TEXT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL,
    query JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    schedule JSONB, -- Scheduling configuration
    recipients JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_analytics_reports_report_type (report_type),
    INDEX idx_analytics_reports_is_active (is_active),
    INDEX idx_analytics_reports_next_run_at (next_run_at),
    INDEX idx_analytics_reports_created_at (created_at)
);

-- Export jobs
CREATE TABLE IF NOT EXISTS analytics_exports (
    id TEXT PRIMARY KEY,
    format VARCHAR(10) CHECK (format IN ('csv', 'json', 'xlsx', 'pdf')),
    query JSONB NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    file_url TEXT,
    file_size INTEGER, -- in bytes
    error_message TEXT,
    user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_analytics_exports_status (status),
    INDEX idx_analytics_exports_user_id (user_id),
    INDEX idx_analytics_exports_created_at (created_at),
    INDEX idx_analytics_exports_expires_at (expires_at)
);

-- Real-time metrics cache (this could be a separate Redis table, but keeping here for completeness)
CREATE TABLE IF NOT EXISTS realtime_metrics (
    metric_name TEXT PRIMARY KEY,
    metric_value DECIMAL(15,2),
    metric_type VARCHAR(20) CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
    unit VARCHAR(20),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_realtime_metrics_timestamp (timestamp),
    INDEX idx_realtime_metrics_expires_at (expires_at)
);

-- Analytics settings
CREATE TABLE IF NOT EXISTS analytics_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    tracking_config JSONB DEFAULT '{}',
    dashboard_config JSONB DEFAULT '{}',
    report_config JSONB DEFAULT '{}',
    privacy_config JSONB DEFAULT '{}',
    alert_config JSONB DEFAULT '{}',
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics alerts
CREATE TABLE IF NOT EXISTS analytics_alerts (
    id TEXT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    condition_metric VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(10) CHECK (condition_operator IN ('gt', 'lt', 'eq', 'gte', 'lte')),
    condition_threshold DECIMAL(15,2) NOT NULL,
    condition_time_window INTEGER DEFAULT 3600, -- in seconds
    condition_aggregation VARCHAR(20) DEFAULT 'average',
    condition_filters JSONB DEFAULT '{}',
    notification_channels JSONB DEFAULT '[]',
    cooldown_minutes INTEGER DEFAULT 60,
    is_enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_analytics_alerts_is_enabled (is_enabled),
    INDEX idx_analytics_alerts_last_triggered_at (last_triggered_at),
    INDEX idx_analytics_alerts_created_at (created_at)
);

-- Alert notifications
CREATE TABLE IF NOT EXISTS alert_notifications (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL REFERENCES analytics_alerts(id) ON DELETE CASCADE,
    channel_type VARCHAR(20) CHECK (channel_type IN ('email', 'slack', 'webhook', 'sms')),
    channel_config JSONB NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_alert_notifications_alert_id (alert_id),
    INDEX idx_alert_notifications_status (status),
    INDEX idx_alert_notifications_created_at (created_at)
);

-- User activity tracking (for engagement metrics)
CREATE TABLE IF NOT EXISTS user_activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'share', 'export', 'customization', 'feedback', 'support_ticket'
    activity_data JSONB DEFAULT '{}',
    session_id TEXT REFERENCES sessions(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_user_activities_user_id (user_id),
    INDEX idx_user_activities_activity_type (activity_type),
    INDEX idx_user_activities_timestamp (timestamp),
    INDEX idx_user_activities_created_at (created_at)
);

-- Add foreign key constraints if not exists
DO $$ 
BEGIN
    -- Add foreign key for sessions.user_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key for session_events.user_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE session_events ADD CONSTRAINT fk_session_events_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key for conversions.user_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE conversions ADD CONSTRAINT fk_conversions_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DO $$
BEGIN
    -- Sessions
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'sessions' AND trigger_name = 'update_sessions_updated_at') THEN
        CREATE TRIGGER update_sessions_updated_at 
            BEFORE UPDATE ON sessions 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Funnels
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'funnels' AND trigger_name = 'update_funnels_updated_at') THEN
        CREATE TRIGGER update_funnels_updated_at 
            BEFORE UPDATE ON funnels 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Behavior patterns
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'behavior_patterns' AND trigger_name = 'update_behavior_patterns_updated_at') THEN
        CREATE TRIGGER update_behavior_patterns_updated_at 
            BEFORE UPDATE ON behavior_patterns 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Dashboards
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'dashboards' AND trigger_name = 'update_dashboards_updated_at') THEN
        CREATE TRIGGER update_dashboards_updated_at 
            BEFORE UPDATE ON dashboards 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Analytics reports
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'analytics_reports' AND trigger_name = 'update_analytics_reports_updated_at') THEN
        CREATE TRIGGER update_analytics_reports_updated_at 
            BEFORE UPDATE ON analytics_reports 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Analytics settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'analytics_settings' AND trigger_name = 'update_analytics_settings_updated_at') THEN
        CREATE TRIGGER update_analytics_settings_updated_at 
            BEFORE UPDATE ON analytics_settings 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Analytics alerts
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE table_name = 'analytics_alerts' AND trigger_name = 'update_analytics_alerts_updated_at') THEN
        CREATE TRIGGER update_analytics_alerts_updated_at 
            BEFORE UPDATE ON analytics_alerts 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Insert default analytics settings
INSERT INTO analytics_settings (id, tracking_config, dashboard_config, report_config, privacy_config, alert_config)
VALUES (
    'global',
    '{
        "events": [
            {"name": "page_view", "category": "navigation", "schema": {"required": ["url"], "optional": ["title"]}},
            {"name": "message_sent", "category": "conversation", "schema": {"required": ["conversation_id"], "optional": ["model", "tokens"]}},
            {"name": "conversation_started", "category": "conversation", "schema": {"required": [], "optional": ["provider"]}},
            {"name": "error_occurred", "category": "error", "schema": {"required": ["error_code"], "optional": ["error_message"]}}
        ],
        "sampling": {"enabled": false, "rate": 1.0},
        "privacy": {"anonymizeIp": true, "respectDoNotTrack": true, "dataRetention": 365},
        "performance": {"bufferSize": 1000, "flushInterval": 60000, "batchSize": 100}
    }',
    '{
        "defaultWidgets": [
            {"type": "metric", "title": "Active Users", "query": {"metrics": ["active_users"], "timeRange": "24h"}},
            {"type": "chart", "title": "Sessions Over Time", "query": {"metrics": ["sessions"], "timeRange": "7d", "granularity": "day"}}
        ],
        "refreshInterval": 300
    }',
    '{
        "autoGenerate": false,
        "schedule": "0 9 * * 1",
        "recipients": []
    }',
    '{
        "gdprCompliant": true,
        "dataMinimization": true,
        "userConsent": true
    }',
    '{
        "defaultChannels": [
            {"type": "email", "config": {"recipients": ["admin@example.com"]}}
        ]
    }'
) ON CONFLICT (id) DO NOTHING;

-- Insert default conversion types
INSERT INTO conversion_types (id, name, description, value, category)
VALUES 
    ('signup', 'User Signup', 'User completed registration process', 0, 'signup'),
    ('subscription', 'Subscription Started', 'User started a paid subscription', 29.99, 'subscription'),
    ('upgrade', 'Plan Upgrade', 'User upgraded to a higher tier', 19.99, 'upgrade'),
    ('referral', 'Referral Completed', 'User successfully referred another user', 10.00, 'referral'),
    ('engagement', 'High Engagement', 'User showed high engagement metrics', 5.00, 'engagement')
ON CONFLICT (id) DO NOTHING;

-- Create default behavior patterns
INSERT INTO behavior_patterns (id, name, description, pattern_type, pattern_definition, confidence, frequency, impact, recommendations)
VALUES 
    ('churn-risk', 'Churn Risk Pattern', 'Users showing signs of potential churn', 'churn', 
     '{"conditions": [{"field": "last_activity_days", "operator": "gt", "value": 7}], "timeWindow": 30, "minOccurrences": 1, "aggregation": "unique"}', 
     0.75, 25, 'high', 
     '["Launch re-engagement campaign", "Offer retention incentives", "Contact at-risk users"]'),
    ('power-users', 'Power User Pattern', 'Highly active users', 'engagement',
     '{"conditions": [{"field": "messages_per_day", "operator": "gt", "value": 20}], "timeWindow": 7, "minOccurrences": 5, "aggregation": "count"}',
     0.85, 10, 'medium',
     '["Create VIP program", "Request detailed feedback", "Offer priority access"]')
ON CONFLICT (id) DO NOTHING;
