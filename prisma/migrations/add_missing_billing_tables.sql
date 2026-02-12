-- Migration pour ajouter les tables manquantes pour la facturation
-- Correction des incohérences entre le schéma existant et les types TypeScript

-- Table des paiements (manquante)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    payment_method JSONB NOT NULL DEFAULT '{}',
    provider VARCHAR(20) NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe', 'paypal', 'wise')),
    provider_transaction_id VARCHAR(255),
    failure_reason TEXT,
    refunded_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Table des abonnements (manquante)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    plan VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    interval VARCHAR(10) NOT NULL CHECK (interval IN ('month', 'year')),
    interval_count INTEGER DEFAULT 1,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Table des plans d'abonnement (manquante)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    interval VARCHAR(10) NOT NULL CHECK (interval IN ('month', 'year')),
    features JSONB NOT NULL DEFAULT '[]',
    limits JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Table des crédits (manquante)
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    reason TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('promotional', 'refund', 'compensation', 'adjustment')),
    expires_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Table des méthodes de paiement (manquante)
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account', 'sepa')),
    provider VARCHAR(20) NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe', 'paypal', 'wise')),
    is_default BOOLEAN DEFAULT FALSE,
    last_four VARCHAR(4),
    expiry_month INTEGER,
    expiry_year INTEGER,
    brand VARCHAR(50),
    provider_method_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Table des logs d'utilisation (manquante pour la facturation)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    response_time_ms INTEGER,
    tokens_returned INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Correction de la table invoices pour ajouter le champ number manquant
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS number VARCHAR(50) UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE;

-- Mise à jour des colonnes existantes pour correspondre aux types TypeScript
ALTER TABLE invoices ALTER COLUMN period TYPE JSONB USING period::JSONB;
ALTER TABLE invoices ALTER COLUMN items TYPE JSONB USING items::JSONB;
ALTER TABLE invoices ALTER COLUMN billing_address TYPE JSONB USING billing_address::JSONB;
ALTER TABLE invoices ALTER COLUMN metadata TYPE JSONB USING metadata::JSONB;

-- Indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_amount ON plans(amount);
CREATE INDEX IF NOT EXISTS idx_plans_interval ON plans(interval);

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_type ON credits(type);
CREATE INDEX IF NOT EXISTS idx_credits_expires_at ON credits(expires_at);
CREATE INDEX IF NOT EXISTS idx_credits_invoice_id ON credits(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_provider ON payment_methods(provider);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tool_name ON usage_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des plans par défaut
INSERT INTO plans (name, description, amount, currency, interval, features, limits, metadata) VALUES
('free', 'Plan gratuit avec limites', 0, 'EUR', 'month', 
 '["API Access", "Basic Support", "1000 requests/month"]',
 '{"requestsPerMonth": 1000, "tokensPerMonth": 10000, "concurrentRequests": 5}',
 '{"tier": "free", "popular": false}'),
('basic', 'Plan basique pour petites équipes', 29, 'EUR', 'month',
 '["API Access", "Email Support", "10000 requests/month", "Advanced Analytics"]',
 '{"requestsPerMonth": 10000, "tokensPerMonth": 100000, "concurrentRequests": 10}',
 '{"tier": "basic", "popular": true}'),
('premium', 'Plan premium pour entreprises', 99, 'EUR', 'month',
 '["API Access", "Priority Support", "Unlimited requests", "Custom Integrations"]',
 '{"requestsPerMonth": null, "tokensPerMonth": null, "concurrentRequests": 50}',
 '{"tier": "premium", "popular": false}'),
('enterprise', 'Plan enterprise avec SLA', 499, 'EUR', 'month',
 '["API Access", "24/7 Support", "Unlimited everything", "Dedicated Infrastructure"]',
 '{"requestsPerMonth": null, "tokensPerMonth": null, "concurrentRequests": null}',
 '{"tier": "enterprise", "popular": false}')
ON CONFLICT (name) DO NOTHING;
