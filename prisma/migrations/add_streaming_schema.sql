-- Migration pour le système de streaming et facturation
-- Créée le 2025-01-13 pour E7-Story7-3

-- Table des connexions de streaming
CREATE TABLE IF NOT EXISTS stream_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) NOT NULL,
    user_id UUID,
    session_id VARCHAR(255),
    request_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('connecting', 'connected', 'streaming', 'completed', 'error', 'disconnected')),
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    options JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les connexions
CREATE INDEX IF NOT EXISTS idx_stream_connections_user_id ON stream_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_connections_client_id ON stream_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_stream_connections_status ON stream_connections(status);
CREATE INDEX IF NOT EXISTS idx_stream_connections_created_at ON stream_connections(created_at);
CREATE INDEX IF NOT EXISTS idx_stream_connections_provider_model ON stream_connections(provider, model);

-- Table des buffers de streaming
CREATE TABLE IF NOT EXISTS stream_buffers (
    connection_id UUID PRIMARY KEY REFERENCES stream_connections(id) ON DELETE CASCADE,
    chunks JSONB NOT NULL DEFAULT '[]',
    max_size INTEGER NOT NULL DEFAULT 8192,
    flush_threshold INTEGER NOT NULL DEFAULT 6554,
    last_flush TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    compression_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des chunks de streaming
CREATE TABLE IF NOT EXISTS stream_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES stream_connections(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('content', 'metadata', 'error', 'control', 'heartbeat')),
    data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    size INTEGER NOT NULL,
    checksum VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les chunks
CREATE INDEX IF NOT EXISTS idx_stream_chunks_connection_id ON stream_chunks(connection_id);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_timestamp ON stream_chunks(timestamp);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_sequence ON stream_chunks(connection_id, sequence);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_type ON stream_chunks(type);

-- Table des métriques de streaming
CREATE TABLE IF NOT EXISTS stream_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES stream_connections(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    performance JSONB NOT NULL DEFAULT '{}',
    quality JSONB NOT NULL DEFAULT '{}',
    network JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les métriques
CREATE INDEX IF NOT EXISTS idx_stream_metrics_connection_id ON stream_metrics(connection_id);
CREATE INDEX IF NOT EXISTS idx_stream_metrics_period ON stream_metrics(period_start, period_end);

-- Table des enregistrements de facturation streaming
CREATE TABLE IF NOT EXISTS stream_billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES stream_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    usage JSONB NOT NULL DEFAULT '{}',
    cost JSONB NOT NULL DEFAULT '{}',
    billing_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (billing_status IN ('pending', 'processed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Index pour la facturation
CREATE INDEX IF NOT EXISTS idx_stream_billing_user_id ON stream_billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_billing_period ON stream_billing_records(period);
CREATE INDEX IF NOT EXISTS idx_stream_billing_status ON stream_billing_records(billing_status);
CREATE INDEX IF NOT EXISTS idx_stream_billing_provider_model ON stream_billing_records(provider, model);

-- Table des configurations de facturation streaming
CREATE TABLE IF NOT EXISTS stream_billing_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    pricing JSONB NOT NULL DEFAULT '{}',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'daily', 'hourly')),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    discounts JSONB NOT NULL DEFAULT '[]',
    sla JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, model)
);

-- Index pour les configs de facturation
CREATE INDEX IF NOT EXISTS idx_stream_billing_configs_provider_model ON stream_billing_configs(provider, model);

-- Table des rapports d'utilisation streaming
CREATE TABLE IF NOT EXISTS stream_usage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

-- Index pour les rapports d'utilisation
CREATE INDEX IF NOT EXISTS idx_stream_usage_reports_user_period ON stream_usage_reports(user_id, period);

-- Table des événements de streaming pour audit
CREATE TABLE IF NOT EXISTS stream_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES stream_connections(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les événements
CREATE INDEX IF NOT EXISTS idx_stream_events_connection_id ON stream_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_type ON stream_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stream_events_timestamp ON stream_events(timestamp);

-- Table des alertes de streaming
CREATE TABLE IF NOT EXISTS stream_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES stream_connections(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les alertes
CREATE INDEX IF NOT EXISTS idx_stream_alerts_connection_id ON stream_alerts(connection_id);
CREATE INDEX IF NOT EXISTS idx_stream_alerts_type ON stream_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_stream_alerts_severity ON stream_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_stream_alerts_resolved ON stream_alerts(resolved);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application du trigger aux tables pertinentes
CREATE TRIGGER update_stream_connections_updated_at BEFORE UPDATE ON stream_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_buffers_updated_at BEFORE UPDATE ON stream_buffers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_usage_reports_updated_at BEFORE UPDATE ON stream_usage_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_billing_configs_updated_at BEFORE UPDATE ON stream_billing_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des configurations de facturation par défaut
INSERT INTO stream_billing_configs (provider, model, pricing, billing_cycle, currency, tax_rate, discounts, sla) VALUES
('openai', 'gpt-3.5-turbo', 
 '{"streaming": {"perSecond": 0.0001, "perMegabyte": 0.01, "peakBandwidthPremium": 0.00001}, "tokens": {"input": 0.001, "output": 0.002}, "infrastructure": {"baseCost": 0.001, "perConnectionHour": 0.01}}',
 'monthly', 'USD', 0.2000,
 '[{"volumeThreshold": 1000000, "discountPercentage": 0.1}, {"volumeThreshold": 10000000, "discountPercentage": 0.2}]',
 '{"uptimeGuarantee": 0.99, "latencyGuarantee": 500, "bandwidthGuarantee": 1048576, "penaltyRate": 0.1}'
),
('openai', 'gpt-4',
 '{"streaming": {"perSecond": 0.0002, "perMegabyte": 0.02, "peakBandwidthPremium": 0.00002}, "tokens": {"input": 0.03, "output": 0.06}, "infrastructure": {"baseCost": 0.002, "perConnectionHour": 0.02}}',
 'monthly', 'USD', 0.2000,
 '[{"volumeThreshold": 500000, "discountPercentage": 0.05}, {"volumeThreshold": 5000000, "discountPercentage": 0.15}]',
 '{"uptimeGuarantee": 0.995, "latencyGuarantee": 300, "bandwidthGuarantee": 2097152, "penaltyRate": 0.15}'
),
('anthropic', 'claude-3-sonnet',
 '{"streaming": {"perSecond": 0.00015, "perMegabyte": 0.015, "peakBandwidthPremium": 0.000015}, "tokens": {"input": 0.003, "output": 0.015}, "infrastructure": {"baseCost": 0.0015, "perConnectionHour": 0.015}}',
 'monthly', 'USD', 0.2000,
 '[{"volumeThreshold": 800000, "discountPercentage": 0.08}, {"volumeThreshold": 8000000, "discountPercentage": 0.18}]',
 '{"uptimeGuarantee": 0.99, "latencyGuarantee": 400, "bandwidthGuarantee": 1572864, "penaltyRate": 0.12}'
),
('google', 'gemini-pro',
 '{"streaming": {"perSecond": 0.00008, "perMegabyte": 0.008, "peakBandwidthPremium": 0.000008}, "tokens": {"input": 0.0005, "output": 0.0015}, "infrastructure": {"baseCost": 0.0008, "perConnectionHour": 0.008}}',
 'monthly', 'USD', 0.2000,
 '[{"volumeThreshold": 2000000, "discountPercentage": 0.12}, {"volumeThreshold": 20000000, "discountPercentage": 0.25}]',
 '{"uptimeGuarantee": 0.98, "latencyGuarantee": 600, "bandwidthGuarantee": 1048576, "penaltyRate": 0.08}'
)
ON CONFLICT (provider, model) DO NOTHING;

-- Commentaires sur les tables
COMMENT ON TABLE stream_connections IS 'Connexions de streaming avec métadonnées complètes';
COMMENT ON TABLE stream_buffers IS 'Buffers temporaires pour les chunks de streaming';
COMMENT ON TABLE stream_chunks IS 'Chunks individuels de données de streaming';
COMMENT ON TABLE stream_metrics IS 'Métriques de performance et qualité par connexion';
COMMENT ON TABLE stream_billing_records IS 'Enregistrements de facturation pour l''usage du streaming';
COMMENT ON TABLE stream_billing_configs IS 'Configurations de tarification par provider/modèle';
COMMENT ON TABLE stream_usage_reports IS 'Rapports d''utilisation agrégés par utilisateur/période';
COMMENT ON TABLE stream_events IS 'Journal d''événements pour audit et debugging';
COMMENT ON TABLE stream_alerts IS 'Alertes système pour monitoring du streaming';
