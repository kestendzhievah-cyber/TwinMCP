-- Schema pour le système LLM et de prompts

-- Tables pour les requêtes LLM
CREATE TABLE IF NOT EXISTS llm_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    messages JSONB NOT NULL,
    context JSONB,
    options JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    response JSONB,
    usage JSONB,
    cost DECIMAL(10, 6),
    latency INTEGER,
    metadata JSONB,
    cache_hit BOOLEAN DEFAULT FALSE,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tables pour les templates de prompts
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(20) DEFAULT 'draft',
    template TEXT NOT NULL,
    variables JSONB,
    examples JSONB,
    metadata JSONB,
    constraints JSONB,
    optimization JSONB,
    testing JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tables pour les exécutions de prompts
CREATE TABLE IF NOT EXISTS prompt_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id),
    template_version VARCHAR(20) NOT NULL,
    variables JSONB,
    rendered_prompt TEXT NOT NULL,
    context JSONB,
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    response TEXT,
    metrics JSONB,
    quality JSONB,
    feedback JSONB,
    ab_test_variant VARCHAR(100),
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tables pour les changements de version
CREATE TABLE IF NOT EXISTS template_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id),
    from_version VARCHAR(20) NOT NULL,
    to_version VARCHAR(20) NOT NULL,
    changes JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tables pour les A/B tests
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    variants JSONB NOT NULL,
    traffic_split JSONB,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    sample_size INTEGER DEFAULT 1000,
    confidence DECIMAL(3, 2) DEFAULT 0.95,
    results JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tables pour les erreurs d'exécution
CREATE TABLE IF NOT EXISTS prompt_execution_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id),
    variables JSONB,
    error_message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tables pour la facturation LLM
CREATE TABLE IF NOT EXISTS llm_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    usage JSONB NOT NULL,
    billing_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_llm_requests_provider_model ON llm_requests(provider, model);
CREATE INDEX IF NOT EXISTS idx_llm_requests_user_id ON llm_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_requests_created_at ON llm_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_requests_status ON llm_requests(status);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_status ON prompt_templates(status);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_name ON prompt_templates(name);

CREATE INDEX IF NOT EXISTS idx_prompt_executions_template_id ON prompt_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_created_at ON prompt_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_user_id ON prompt_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_created_at ON ab_tests(created_at);

CREATE INDEX IF NOT EXISTS idx_llm_billing_user_period ON llm_billing(user_id, period);
CREATE INDEX IF NOT EXISTS idx_llm_billing_status ON llm_billing(billing_status);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_llm_requests_updated_at BEFORE UPDATE ON llm_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
