-- src/db/schema/vector-storage.sql
-- Extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Types personnalisés pour les métadonnées
CREATE TYPE content_type AS ENUM ('text', 'code', 'example', 'api', 'tutorial', 'reference');
CREATE TYPE embedding_model AS ENUM ('text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002');
CREATE TYPE chunk_status AS ENUM ('pending', 'processing', 'indexed', 'error');

-- Table principale pour les embeddings
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    chunk_id TEXT NOT NULL,                    -- ID unique du chunk dans le document
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,         -- SHA-256 pour déduplication
    embedding vector(1536) NOT NULL,           -- Dimensions par défaut
    embedding_model embedding_model NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    
    -- Métadonnées du chunk
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Informations sur le document source
    source_url TEXT,
    source_title TEXT,
    source_section TEXT,
    source_subsection TEXT,
    file_path TEXT,
    line_start INTEGER,
    line_end INTEGER,
    
    -- Position et structure
    chunk_index INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    parent_chunk_id UUID REFERENCES document_embeddings(id),
    
    -- Statut et traitement
    status chunk_status DEFAULT 'pending',
    error_message TEXT,
    processing_attempts INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    indexed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_library_chunk UNIQUE (library_id, chunk_id),
    CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0 AND chunk_index < total_chunks),
    CONSTRAINT valid_processing_attempts CHECK (processing_attempts >= 0)
);

-- Table pour les index vectoriels multiples (différents modèles)
CREATE TABLE vector_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    model embedding_model NOT NULL,
    dimensions INTEGER NOT NULL,
    index_type VARCHAR(50) NOT NULL, -- 'ivfflat', 'hnsw', 'exact'
    index_params JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les sessions de recherche
CREATE TABLE search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    query TEXT NOT NULL,
    query_embedding vector(1536),
    filters JSONB DEFAULT '{}',
    results_count INTEGER,
    search_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Table pour les analytics de recherche
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES search_sessions(id),
    library_id UUID REFERENCES libraries(id),
    chunk_id UUID REFERENCES document_embeddings(id),
    rank INTEGER NOT NULL,
    score DECIMAL(5,4) NOT NULL,
    clicked BOOLEAN DEFAULT false,
    dwell_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index vectoriels principaux
CREATE INDEX idx_document_embeddings_embedding_ivfflat 
ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 1000);

-- Index HNSW pour plus de performance (alternative)
-- CREATE INDEX idx_document_embeddings_embedding_hnsw 
-- ON document_embeddings 
-- USING hnsw (embedding vector_cosine_ops) 
-- WITH (m = 16, ef_construction = 64);

-- Index pour les filtres fréquents
CREATE INDEX idx_document_embeddings_library_id ON document_embeddings(library_id);
CREATE INDEX idx_document_embeddings_status ON document_embeddings(status);
CREATE INDEX idx_document_embeddings_model ON document_embeddings(embedding_model);
CREATE INDEX idx_document_embeddings_created_at ON document_embeddings(created_at DESC);

-- Index composite pour les recherches optimisées
CREATE INDEX idx_document_embeddings_library_model_status 
ON document_embeddings(library_id, embedding_model, status);

-- Index GIN sur les métadonnées
CREATE INDEX idx_document_embeddings_metadata_gin 
ON document_embeddings 
USING GIN (metadata);

-- Index sur le hash pour déduplication
CREATE INDEX idx_document_embeddings_content_hash ON document_embeddings(content_hash);

-- Index pour les requêtes récentes
CREATE INDEX idx_document_embeddings_last_accessed 
ON document_embeddings(last_accessed_at DESC);

-- Trigger pour la mise à jour des timestamps
CREATE OR REPLACE FUNCTION update_vector_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Mise à jour du last_accessed_at si le contenu change
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.last_accessed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vector_timestamps
    BEFORE UPDATE ON document_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_vector_timestamps();

-- Trigger pour le nettoyage des sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM search_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Scheduler pour le nettoyage (pg_cron extension requise)
-- SELECT cron.schedule('cleanup-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');

-- Vue pour les statistiques des embeddings
CREATE OR REPLACE VIEW embedding_stats AS
SELECT 
    COUNT(*) as total_embeddings,
    embedding_model,
    COUNT(CASE WHEN status = 'indexed' THEN 1 END) as indexed_count,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
    AVG(LENGTH(content)) as avg_content_length,
    MIN(created_at) as oldest_embedding,
    MAX(created_at) as newest_embedding
FROM document_embeddings
GROUP BY embedding_model;

-- Vue pour les analytics de recherche
CREATE OR REPLACE VIEW search_analytics_summary AS
SELECT 
    DATE(ss.created_at) as search_date,
    COUNT(*) as total_searches,
    AVG(ss.results_count) as avg_results_count,
    AVG(ss.search_time_ms) as avg_search_time_ms,
    COUNT(DISTINCT ss.user_id) as unique_users
FROM search_sessions ss
GROUP BY DATE(ss.created_at)
ORDER BY search_date DESC;

-- Commentaires sur les tables
COMMENT ON TABLE document_embeddings IS 'Stocke les fragments de documents avec leurs embeddings vectoriels';
COMMENT ON TABLE vector_indexes IS 'Configuration des index vectoriels pour différents modèles';
COMMENT ON TABLE search_sessions IS 'Sessions de recherche pour analytics et monitoring';
COMMENT ON TABLE search_analytics IS 'Analytics détaillées sur les interactions de recherche';

-- Commentaires sur les colonnes importantes
COMMENT ON COLUMN document_embeddings.embedding IS 'Vecteur d''embedding pour la recherche sémantique';
COMMENT ON COLUMN document_embeddings.content_hash IS 'Hash SHA-256 pour la déduplication de contenu';
COMMENT ON COLUMN document_embeddings.status IS 'Statut du traitement: pending, processing, indexed, error';
COMMENT ON COLUMN search_sessions.query_embedding IS 'Embedding de la requête pour analyse de similarité';
COMMENT ON COLUMN search_analytics.dwell_time_ms IS 'Temps passé sur un résultat avant la prochaine action';
