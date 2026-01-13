-- Migration pour améliorer le modèle ApiKey selon les spécifications de la Story 3.2

-- Ajouter les nouvelles colonnes à la table api_keys
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium', 'enterprise')),
ADD COLUMN IF NOT EXISTS quota_daily INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS quota_monthly INTEGER DEFAULT 3000,
ADD COLUMN IF NOT EXISTS used_daily INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_monthly INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Créer la table api_key_usage pour le tracking détaillé
CREATE TABLE IF NOT EXISTS api_key_usage (
  key_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  requests_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  last_request_at TIMESTAMP,
  PRIMARY KEY (key_id, date),
  FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Créer les index pour la performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON api_keys(tier);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_date ON api_key_usage(date);

-- Mettre à jour les enregistrements existants
UPDATE api_keys 
SET 
  tier = COALESCE(tier, 'free'),
  quota_daily = COALESCE(quota_daily, 100),
  quota_monthly = COALESCE(quota_monthly, 3000),
  used_daily = COALESCE(used_daily, 0),
  used_monthly = COALESCE(used_monthly, 0),
  is_active = COALESCE(is_active, true),
  permissions = COALESCE(permissions, '[]'),
  updated_at = NOW()
WHERE tier IS NULL 
   OR quota_daily IS NULL 
   OR quota_monthly IS NULL 
   OR used_daily IS NULL 
   OR used_monthly IS NULL 
   OR is_active IS NULL 
   OR permissions IS NULL;

-- Supprimer les anciennes colonnes si elles existent
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'quota_requests_per_minute') THEN
        ALTER TABLE api_keys DROP COLUMN quota_requests_per_minute;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'quota_requests_per_day') THEN
        ALTER TABLE api_keys DROP COLUMN quota_requests_per_day;
    END IF;
END $$;
