-- Regions table
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    health_check_url VARCHAR(500),
    last_health_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Backups table
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    size_bytes BIGINT,
    region VARCHAR(20) NOT NULL,
    storage_class VARCHAR(50) DEFAULT 'STANDARD',
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Failover events table
CREATE TABLE IF NOT EXISTS failover_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_region VARCHAR(20) NOT NULL,
    to_region VARCHAR(20) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'initiated',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    metadata JSONB DEFAULT '{}'
);

-- Health checks table
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region VARCHAR(20) NOT NULL,
    service VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    latency_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_region ON backups(region);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);
CREATE INDEX IF NOT EXISTS idx_failover_events_from_region ON failover_events(from_region);
CREATE INDEX IF NOT EXISTS idx_failover_events_to_region ON failover_events(to_region);
CREATE INDEX IF NOT EXISTS idx_health_checks_region ON health_checks(region);
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at);

-- Insert default regions
INSERT INTO regions (name, code, endpoint, status, priority) VALUES
    ('US East (N. Virginia)', 'us-east-1', 'https://us-east-1.twinmcp.com', 'active', 1),
    ('EU West (Ireland)', 'eu-west-1', 'https://eu-west-1.twinmcp.com', 'active', 2),
    ('Asia Pacific (Singapore)', 'ap-southeast-1', 'https://ap-southeast-1.twinmcp.com', 'active', 3)
ON CONFLICT (code) DO NOTHING;
