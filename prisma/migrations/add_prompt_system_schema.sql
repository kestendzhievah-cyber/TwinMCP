-- Migration pour le système de prompts
-- Ajout des tables pour le système de gestion de prompts

-- Table des catégories de prompts
CREATE TABLE IF NOT EXISTS prompt_categories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_category VARCHAR(255),
    icon VARCHAR(50),
    color VARCHAR(20),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category) REFERENCES prompt_categories(id)
);

-- Table des templates de prompts
CREATE TABLE IF NOT EXISTS prompt_templates (
    id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]',
    examples JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    constraints JSONB NOT NULL DEFAULT '{}',
    optimization JSONB NOT NULL DEFAULT '{}',
    testing JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, version),
    FOREIGN KEY (category) REFERENCES prompt_categories(id)
);

-- Table des changements de version
CREATE TABLE IF NOT EXISTS template_changes (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    from_version VARCHAR(50) NOT NULL,
    to_version VARCHAR(50) NOT NULL,
    changes JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES prompt_templates(id)
);

-- Table des exécutions de prompts
CREATE TABLE IF NOT EXISTS prompt_executions (
    id VARCHAR(255) PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    template_version VARCHAR(50) NOT NULL,
    variables JSONB NOT NULL DEFAULT '{}',
    rendered_prompt TEXT NOT NULL,
    context JSONB,
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    response TEXT,
    metrics JSONB NOT NULL DEFAULT '{}',
    quality JSONB NOT NULL DEFAULT '{}',
    feedback JSONB,
    ab_test_variant VARCHAR(255),
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id, template_version) REFERENCES prompt_templates(id, version)
);

-- Table des erreurs d'exécution
CREATE TABLE IF NOT EXISTS prompt_execution_errors (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    variables JSONB NOT NULL DEFAULT '{}',
    error_message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tests A/B
CREATE TABLE IF NOT EXISTS ab_tests (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    variants JSONB NOT NULL DEFAULT '[]',
    traffic_split JSONB NOT NULL DEFAULT '{}',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    sample_size INTEGER DEFAULT 1000,
    confidence DECIMAL(3,2) DEFAULT 0.95,
    results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des enregistrements d'optimisation
CREATE TABLE IF NOT EXISTS optimization_records (
    id VARCHAR(255) PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    type VARCHAR(50) NOT NULL,
    reason TEXT,
    changes JSONB NOT NULL DEFAULT '[]',
    metrics_before JSONB NOT NULL DEFAULT '{}',
    metrics_after JSONB NOT NULL DEFAULT '{}',
    improvement DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES prompt_templates(id)
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_prompt_templates_status ON prompt_templates(status);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_template_id ON prompt_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_created_at ON prompt_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_user_id ON prompt_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_optimization_records_template_id ON optimization_records(template_id);

-- Insertion des catégories par défaut
INSERT INTO prompt_categories (id, name, description, icon, color, order_index) VALUES
('chat', 'Chat & Conversation', 'Templates for conversational AI', '💬', '#3B82F6', 1),
('documentation', 'Documentation', 'Templates for documentation generation and analysis', '📚', '#10B981', 2),
('code', 'Code Generation', 'Templates for code generation and analysis', '💻', '#8B5CF6', 3),
('analysis', 'Analysis & Research', 'Templates for data analysis and research', '🔍', '#F59E0B', 4),
('system', 'System & Utility', 'System-level and utility templates', '⚙️', '#6B7280', 5)
ON CONFLICT (id) DO NOTHING;
