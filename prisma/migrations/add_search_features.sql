-- Migration pour ajouter les fonctionnalités de recherche avancée

-- Extension PostgreSQL pour la recherche textuelle et le matching flou
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Ajout de colonnes pour la recherche avancée dans la table libraries
ALTER TABLE libraries 
ADD COLUMN IF NOT EXISTS search_vector tsvector,
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS popularity_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS maintenance_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS weekly_downloads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP;

-- Création d'un index GIN pour la recherche textuelle
CREATE INDEX IF NOT EXISTS idx_libraries_search_vector ON libraries USING GIN(search_vector);

-- Création d'un index pour le matching flou (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_libraries_name_trgm ON libraries USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_libraries_description_trgm ON libraries USING GIN(description gin_trgm_ops);

-- Table pour les logs de recherche
CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    result_count INTEGER DEFAULT 0,
    clicked_result UUID REFERENCES libraries(id) ON DELETE SET NULL,
    search_time INTEGER, -- en millisecondes
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les clics sur les résultats de recherche
CREATE TABLE IF NOT EXISTS search_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    position INTEGER, -- position dans les résultats
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les scores de pertinence appris
CREATE TABLE IF NOT EXISTS search_relevance (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (library_id, query)
);

-- Table pour les tags de bibliothèques
CREATE TABLE IF NOT EXISTS library_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    description TEXT,
    color VARCHAR(7), -- format hex #RRGGBB
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table d'association entre bibliothèques et tags
CREATE TABLE IF NOT EXISTS library_tag_associations (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (library_id, tag_id)
);

-- Table pour les dépendances de bibliothèques
CREATE TABLE IF NOT EXISTS library_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    dependency_library_id UUID REFERENCES libraries(id) ON DELETE SET NULL,
    dependency_name VARCHAR(255) NOT NULL,
    version_range VARCHAR(100),
    dependency_type VARCHAR(50) DEFAULT 'dependencies', -- dependencies, devDependencies, peerDependencies
    is_external BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les mainteneurs de bibliothèques
CREATE TABLE IF NOT EXISTS maintainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_username VARCHAR(255) UNIQUE,
    npm_username VARCHAR(255),
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    public_repos INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table d'association entre bibliothèques et mainteneurs
CREATE TABLE IF NOT EXISTS library_maintainers (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    maintainer_id UUID NOT NULL REFERENCES maintainers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'maintainer', -- owner, maintainer, contributor
    PRIMARY KEY (library_id, maintainer_id)
);

-- Index pour les performances de recherche
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_search_clicks_library_id ON search_clicks(library_id);
CREATE INDEX IF NOT EXISTS idx_search_clicks_query ON search_clicks(query);
CREATE INDEX IF NOT EXISTS idx_search_clicks_created_at ON search_clicks(created_at);

CREATE INDEX IF NOT EXISTS idx_library_tags_name ON library_tags(name);
CREATE INDEX IF NOT EXISTS idx_library_tags_category ON library_tags(category);

-- Trigger pour mettre à jour le vecteur de recherche
CREATE OR REPLACE FUNCTION update_library_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.display_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.language, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création du trigger
DROP TRIGGER IF EXISTS trigger_update_library_search_vector ON libraries;
CREATE TRIGGER trigger_update_library_search_vector
    BEFORE INSERT OR UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();

-- Trigger pour mettre à jour le updated_at des mainteneurs
CREATE OR REPLACE FUNCTION update_maintainers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_maintainers_updated_at ON maintainers;
CREATE TRIGGER trigger_update_maintainers_updated_at
    BEFORE UPDATE ON maintainers
    FOR EACH ROW EXECUTE FUNCTION update_maintainers_updated_at();

-- Insertion de tags initiaux
INSERT INTO library_tags (name, category, description, color) VALUES
('frontend', 'category', 'Frontend frameworks and libraries', '#61dafb'),
('backend', 'category', 'Backend frameworks and servers', '#68a063'),
('database', 'category', 'Database and ORM libraries', '#336791'),
('testing', 'category', 'Testing frameworks and utilities', '#c21325'),
('build-tools', 'category', 'Build tools and bundlers', '#8dd6f9'),
('styling', 'category', 'CSS and styling solutions', '#ff6b6b'),
('state-management', 'category', 'State management libraries', '#764abc'),
('routing', 'category', 'Routing and navigation', '#ff6b35'),
('authentication', 'category', 'Authentication and authorization', '#ff4757'),
('utilities', 'category', 'Utility libraries and helpers', '#95afc0')
ON CONFLICT (name) DO NOTHING;

-- Vue pour les statistiques de recherche
CREATE OR REPLACE VIEW search_stats AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_searches,
    COUNT(DISTINCT query) as unique_queries,
    AVG(result_count) as avg_results,
    COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_result_searches
FROM search_logs 
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
