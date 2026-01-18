-- Migration pour le schéma de facturation complet
-- Ajout des tables pour les factures, le streaming et la facturation

-- Extension pour les UUID si non présente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des profils utilisateurs pour les adresses de facturation
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des factures
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_date TIMESTAMP WITH TIME ZONE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    items JSONB NOT NULL DEFAULT '[]',
    billing_address JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des connexions streaming
CREATE TABLE IF NOT EXISTS stream_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    request_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'connected', 'streaming', 'completed', 'error', 'disconnected')),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    options JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des chunks streaming
CREATE TABLE IF NOT EXISTS stream_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES stream_connections(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('content', 'metadata', 'error', 'control', 'heartbeat')),
    data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    size INTEGER NOT NULL DEFAULT 0,
    checksum VARCHAR(64)
);

-- Table des métriques streaming
CREATE TABLE IF NOT EXISTS stream_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES stream_connections(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    performance JSONB NOT NULL DEFAULT '{}',
    quality JSONB NOT NULL DEFAULT '{}',
    network JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des enregistrements de facturation streaming
CREATE TABLE IF NOT EXISTS stream_billing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES stream_connections(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    usage JSONB NOT NULL DEFAULT '{}',
    cost JSONB NOT NULL DEFAULT '{}',
    billing_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (billing_status IN ('pending', 'processed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Table des configurations de facturation streaming
CREATE TABLE IF NOT EXISTS stream_billing_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    pricing JSONB NOT NULL DEFAULT '{}',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tax_rate DECIMAL(5,4) DEFAULT 0,
    discounts JSONB DEFAULT '[]',
    sla JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, model)
);

-- Table des rapports d'utilisation streaming
CREATE TABLE IF NOT EXISTS stream_usage_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    total_usage JSONB NOT NULL DEFAULT '{}',
    by_provider JSONB NOT NULL DEFAULT '{}',
    by_purpose JSONB NOT NULL DEFAULT '{}',
    performance JSONB NOT NULL DEFAULT '{}',
    trends JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period)
);

-- Table des rapports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type JSONB NOT NULL DEFAULT '{}',
    category JSONB NOT NULL DEFAULT '{}',
    frequency JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    config JSONB NOT NULL DEFAULT '{}',
    schedule JSONB DEFAULT '{}',
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    recipients JSONB DEFAULT '[]',
    output JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des générations de rapports
CREATE TABLE IF NOT EXISTS report_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress JSONB NOT NULL DEFAULT '{}',
    config JSONB NOT NULL DEFAULT '{}',
    data JSONB,
    output JSONB DEFAULT '{}',
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Table des insights
CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
    data JSONB NOT NULL DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE
);

-- Table des dashboards
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'operational',
    layout JSONB NOT NULL DEFAULT '{}',
    widgets JSONB NOT NULL DEFAULT '[]',
    filters JSONB DEFAULT '[]',
    refresh_interval INTEGER DEFAULT 300,
    permissions JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des templates de rapports
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    layout JSONB NOT NULL DEFAULT '{}',
    sections JSONB NOT NULL DEFAULT '[]',
    styling JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);

CREATE INDEX IF NOT EXISTS idx_stream_connections_user_id ON stream_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_connections_status ON stream_connections(status);
CREATE INDEX IF NOT EXISTS idx_stream_connections_provider ON stream_connections(provider);
CREATE INDEX IF NOT EXISTS idx_stream_connections_created_at ON stream_connections(created_at);

CREATE INDEX IF NOT EXISTS idx_stream_chunks_connection_id ON stream_chunks(connection_id);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_timestamp ON stream_chunks(timestamp);

CREATE INDEX IF NOT EXISTS idx_stream_metrics_connection_id ON stream_metrics(connection_id);
CREATE INDEX IF NOT EXISTS idx_stream_metrics_period ON stream_metrics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_stream_billing_records_user_id ON stream_billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_billing_records_period ON stream_billing_records(period);
CREATE INDEX IF NOT EXISTS idx_stream_billing_records_provider ON stream_billing_records(provider);
CREATE INDEX IF NOT EXISTS idx_stream_billing_records_status ON stream_billing_records(billing_status);

CREATE INDEX IF NOT EXISTS idx_stream_usage_reports_user_period ON stream_usage_reports(user_id, period);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_last_run ON reports(last_run);

CREATE INDEX IF NOT EXISTS idx_report_generations_report_id ON report_generations(report_id);
CREATE INDEX IF NOT EXISTS idx_report_generations_status ON report_generations(status);

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON insights(severity);
CREATE INDEX IF NOT EXISTS idx_insights_timestamp ON insights(timestamp);
CREATE INDEX IF NOT EXISTS idx_insights_report_id ON insights(report_id);

CREATE INDEX IF NOT EXISTS idx_dashboards_type ON dashboards(type);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application des triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_connections_updated_at BEFORE UPDATE ON stream_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_billing_configs_updated_at BEFORE UPDATE ON stream_billing_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_usage_reports_updated_at BEFORE UPDATE ON stream_usage_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des configurations de facturation par défaut
INSERT INTO stream_billing_configs (provider, model, pricing, billing_cycle, currency, tax_rate, discounts, sla) VALUES
('openai', 'gpt-3.5-turbo', 
 '{"streaming": {"perSecond": 0.0001, "perMegabyte": 0.01, "peakBandwidthPremium": 0.00001}, "tokens": {"input": 0.001, "output": 0.002}, "infrastructure": {"baseCost": 0.001, "perConnectionHour": 0.01}}',
 'monthly', 'USD', 0.2,
 '[{"volumeThreshold": 1000000, "discountPercentage": 0.1}, {"volumeThreshold": 10000000, "discountPercentage": 0.2}]',
 '{"uptimeGuarantee": 0.99, "latencyGuarantee": 500, "bandwidthGuarantee": 1048576, "penaltyRate": 0.1}'
),
('openai', 'gpt-4',
 '{"streaming": {"perSecond": 0.0002, "perMegabyte": 0.02, "peakBandwidthPremium": 0.00002}, "tokens": {"input": 0.03, "output": 0.06}, "infrastructure": {"baseCost": 0.002, "perConnectionHour": 0.02}}',
 'monthly', 'USD', 0.2,
 '[{"volumeThreshold": 500000, "discountPercentage": 0.05}, {"volumeThreshold": 5000000, "discountPercentage": 0.15}]',
 '{"uptimeGuarantee": 0.995, "latencyGuarantee": 300, "bandwidthGuarantee": 2097152, "penaltyRate": 0.15}'
),
('anthropic', 'claude-3-sonnet',
 '{"streaming": {"perSecond": 0.00015, "perMegabyte": 0.015, "peakBandwidthPremium": 0.000015}, "tokens": {"input": 0.003, "output": 0.015}, "infrastructure": {"baseCost": 0.0015, "perConnectionHour": 0.015}}',
 'monthly', 'USD', 0.2,
 '[{"volumeThreshold": 800000, "discountPercentage": 0.08}, {"volumeThreshold": 8000000, "discountPercentage": 0.18}]',
 '{"uptimeGuarantee": 0.99, "latencyGuarantee": 400, "bandwidthGuarantee": 1572864, "penaltyRate": 0.12}'
),
('google', 'gemini-pro',
 '{"streaming": {"perSecond": 0.00008, "perMegabyte": 0.008, "peakBandwidthPremium": 0.000008}, "tokens": {"input": 0.0005, "output": 0.0015}, "infrastructure": {"baseCost": 0.0008, "perConnectionHour": 0.008}}',
 'monthly', 'USD', 0.2,
 '[{"volumeThreshold": 2000000, "discountPercentage": 0.12}, {"volumeThreshold": 20000000, "discountPercentage": 0.25}]',
 '{"uptimeGuarantee": 0.98, "latencyGuarantee": 600, "bandwidthGuarantee": 1048576, "penaltyRate": 0.08}'
)
ON CONFLICT (provider, model) DO NOTHING;
