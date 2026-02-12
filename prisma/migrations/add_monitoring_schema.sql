-- Migration pour ajouter le schéma de monitoring GitHub

-- Table pour les repositories monitorés
CREATE TABLE IF NOT EXISTS monitored_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id INTEGER NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(511) NOT NULL,
    default_branch VARCHAR(255) NOT NULL DEFAULT 'main',
    monitoring_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_monitored_repo UNIQUE (owner, name)
);

-- Table pour les releases détectées
CREATE TABLE IF NOT EXISTS detected_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    release_id INTEGER NOT NULL,
    tag_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    body TEXT,
    prerelease BOOLEAN DEFAULT false,
    draft BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    author_login VARCHAR(255),
    assets_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_release UNIQUE (repository_id, release_id)
);

-- Table pour les changements de dépendances
CREATE TABLE IF NOT EXISTS dependency_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    commit_sha VARCHAR(40),
    branch VARCHAR(255),
    changes JSONB NOT NULL, -- { new: [], removed: [], updated: [] }
    package_json JSONB,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT false
);

-- Table pour les statistiques de monitoring
CREATE TABLE IF NOT EXISTS monitoring_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_owner VARCHAR(255) NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    stats JSONB NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les événements webhook
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_monitored_repositories_active ON monitored_repositories(is_active);
CREATE INDEX IF NOT EXISTS idx_monitored_repositories_last_checked ON monitored_repositories(last_checked);
CREATE INDEX IF NOT EXISTS idx_detected_releases_published_at ON detected_releases(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_dependency_changes_detected_at ON dependency_changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_stats_recorded_at ON monitoring_stats(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_stats_repo ON monitoring_stats(repository_owner, repository_name);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_monitoring_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monitored_repositories_updated_at ON monitored_repositories;
CREATE TRIGGER update_monitored_repositories_updated_at
    BEFORE UPDATE ON monitored_repositories
    FOR EACH ROW EXECUTE FUNCTION update_monitoring_timestamps();
