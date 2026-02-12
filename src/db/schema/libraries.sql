-- Extensions PostgreSQL pour la recherche textuelle et fuzzy matching
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- Bibliothèques principales
CREATE TABLE libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    github_url TEXT,
    npm_url TEXT,
    homepage_url TEXT,
    repository_url TEXT,
    license VARCHAR(100),
    latest_version VARCHAR(50),
    total_downloads BIGINT DEFAULT 0,
    weekly_downloads BIGINT DEFAULT 0,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    issues INTEGER DEFAULT 0,
    language VARCHAR(50) DEFAULT 'JavaScript',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'archived')),
    quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
    popularity_score DECIMAL(3,2) CHECK (popularity_score >= 0 AND popularity_score <= 1),
    maintenance_score DECIMAL(3,2) CHECK (maintenance_score >= 0 AND maintenance_score <= 1),
    last_updated_at TIMESTAMP WITH TIME ZONE,
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index pour la recherche
    search_vector tsvector,
    
    -- Contraintes
    CONSTRAINT unique_library_name UNIQUE (name),
    CONSTRAINT valid_github_url CHECK (github_url ~ '^https://github\.com/[^/]+/[^/]+$' OR github_url IS NULL),
    CONSTRAINT valid_npm_url CHECK (npm_url ~ '^https://www\.npmjs\.com/package/[^/]+$' OR npm_url IS NULL)
);

-- Versions des bibliothèques
CREATE TABLE library_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    is_latest BOOLEAN DEFAULT false,
    is_prerelease BOOLEAN DEFAULT false,
    release_date TIMESTAMP WITH TIME ZONE,
    downloads BIGINT DEFAULT 0,
    deprecated BOOLEAN DEFAULT false,
    deprecation_message TEXT,
    engines JSONB, -- { "node": ">=14", "npm": ">=6" }
    dependencies JSONB, -- { "dependencies": {}, "devDependencies": {}, "peerDependencies": {} }
    dist JSONB, -- { "size": 12345, "unpackedSize": 54321 }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_library_version UNIQUE (library_id, version)
);

-- Tags et catégories
CREATE TABLE library_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50),
    description TEXT,
    color VARCHAR(7), -- hex color
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Association bibliothèques-tags
CREATE TABLE library_tag_associations (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
    confidence DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (library_id, tag_id)
);

-- Dépendances entre bibliothèques
CREATE TABLE library_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    dependency_library_id UUID REFERENCES libraries(id) ON DELETE SET NULL,
    dependency_name VARCHAR(255) NOT NULL, -- pour les deps externes
    version_range VARCHAR(100),
    dependency_type VARCHAR(20) NOT NULL CHECK (dependency_type IN ('dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies')),
    is_external BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mainteneurs
CREATE TABLE maintainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_username VARCHAR(255) UNIQUE,
    npm_username VARCHAR(255),
    name VARCHAR(255),
    email TEXT,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(255),
    company VARCHAR(255),
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    public_repos INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Association bibliothèques-mainteneurs
CREATE TABLE library_maintainers (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    maintainer_id UUID NOT NULL REFERENCES maintainers(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'maintainer' CHECK (role IN ('owner', 'maintainer', 'contributor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (library_id, maintainer_id)
);

-- Index pour la recherche textuelle
CREATE INDEX idx_libraries_search_vector ON libraries USING GIN(search_vector);
CREATE INDEX idx_libraries_name_trgm ON libraries USING GIN(name gin_trgm_ops);
CREATE INDEX idx_libraries_description_trgm ON libraries USING GIN(description gin_trgm_ops);

-- Index pour les filtres
CREATE INDEX idx_libraries_status ON libraries(status);
CREATE INDEX idx_libraries_language ON libraries(language);
CREATE INDEX idx_libraries_quality_score ON libraries(quality_score DESC);
CREATE INDEX idx_libraries_popularity_score ON libraries(popularity_score DESC);
CREATE INDEX idx_libraries_last_updated ON libraries(last_updated_at DESC);

-- Index pour les versions
CREATE INDEX idx_library_versions_library_latest ON library_versions(library_id, is_latest);
CREATE INDEX idx_library_versions_release_date ON library_versions(release_date DESC);

-- Trigger pour mettre à jour le search_vector
CREATE OR REPLACE FUNCTION update_library_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.display_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(
            ARRAY(SELECT t.name FROM library_tags t 
                  JOIN library_tag_associations a ON t.id = a.tag_id 
                  WHERE a.library_id = NEW.id), ' ', ''
        ), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_library_search_vector
    BEFORE INSERT OR UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();
