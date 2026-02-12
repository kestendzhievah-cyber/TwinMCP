-- Extension pgvector pour les opérations vectorielles
CREATE EXTENSION IF NOT EXISTS vector;

-- Table pour les chunks de documents avec embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- Dimension par défaut pour text-embedding-3-small/ada-002
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding_model VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    position INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les métadonnées enrichies des documents
CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    section VARCHAR(255),
    subsection VARCHAR(255),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('text', 'code', 'example', 'api')),
    code_language VARCHAR(50),
    version VARCHAR(50),
    file_path TEXT,
    last_modified TIMESTAMP WITH TIME ZONE,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour le suivi des générations d'embeddings
CREATE TABLE IF NOT EXISTS embedding_generation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES libraries(id) ON DELETE CASCADE,
    model VARCHAR(50) NOT NULL,
    chunks_processed INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    total_cost DECIMAL(10,6) NOT NULL,
    average_processing_time INTEGER NOT NULL, -- en millisecondes
    cache_hit_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    error_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les statistiques de cache
CREATE TABLE IF NOT EXISTS cache_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    model VARCHAR(50) NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    cache_hits INTEGER NOT NULL DEFAULT 0,
    cache_misses INTEGER NOT NULL DEFAULT 0,
    hit_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, model)
);

-- Index vectoriel pour la recherche rapide avec IVFFlat
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index pour les filtres communs
CREATE INDEX IF NOT EXISTS idx_document_chunks_library_id ON document_chunks(library_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_model ON document_chunks(embedding_model);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created_at ON document_chunks(created_at);

-- Index sur les métadonnées
CREATE INDEX IF NOT EXISTS idx_document_metadata_library_id ON document_metadata(library_id);
CREATE INDEX IF NOT EXISTS idx_document_metadata_content_type ON document_metadata(content_type);
CREATE INDEX IF NOT EXISTS idx_document_metadata_code_language ON document_metadata(code_language);
CREATE INDEX IF NOT EXISTS idx_document_metadata_section ON document_metadata(section);
CREATE INDEX IF NOT EXISTS idx_document_metadata_version ON document_metadata(version);
CREATE INDEX IF NOT EXISTS idx_document_metadata_last_modified ON document_metadata(last_modified);

-- Index composites pour les recherches optimisées
CREATE INDEX IF NOT EXISTS idx_document_chunks_library_model ON document_chunks(library_id, embedding_model);
CREATE INDEX IF NOT EXISTS idx_document_metadata_library_type ON document_metadata(library_id, content_type);

-- Index sur les logs de génération
CREATE INDEX IF NOT EXISTS idx_embedding_generation_log_library_id ON embedding_generation_log(library_id);
CREATE INDEX IF NOT EXISTS idx_embedding_generation_log_created_at ON embedding_generation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_generation_log_model ON embedding_generation_log(model);

-- Index sur les statistiques de cache
CREATE INDEX IF NOT EXISTS idx_cache_statistics_date_model ON cache_statistics(date, model);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application des triggers
DROP TRIGGER IF EXISTS update_document_chunks_updated_at ON document_chunks;
CREATE TRIGGER update_document_chunks_updated_at
    BEFORE UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_metadata_updated_at ON document_metadata;
CREATE TRIGGER update_document_metadata_updated_at
    BEFORE UPDATE ON document_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cache_statistics_updated_at ON cache_statistics;
CREATE TRIGGER update_cache_statistics_updated_at
    BEFORE UPDATE ON cache_statistics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vue pour les statistiques d'embeddings par bibliothèque
CREATE OR REPLACE VIEW library_embedding_stats AS
SELECT 
    l.id as library_id,
    l.name as library_name,
    COUNT(dc.id) as total_chunks,
    COUNT(dc.embedding) as indexed_chunks,
    ROUND(
        (COUNT(dc.embedding)::DECIMAL / NULLIF(COUNT(dc.id), 0)) * 100, 2
    ) as indexing_percentage,
    MAX(dc.updated_at) as last_indexed,
    SUM(egl.total_cost) as total_cost,
    SUM(egl.total_tokens) as total_tokens
FROM libraries l
LEFT JOIN document_chunks dc ON l.id = dc.library_id
LEFT JOIN embedding_generation_log egl ON l.id = egl.library_id
GROUP BY l.id, l.name;

-- Vue pour les statistiques de performance par modèle
CREATE OR REPLACE VIEW model_performance_stats AS
SELECT 
    model,
    COUNT(*) as total_generations,
    SUM(chunks_processed) as total_chunks,
    SUM(total_tokens) as total_tokens,
    SUM(total_cost) as total_cost,
    ROUND(AVG(average_processing_time), 2) as avg_processing_time,
    ROUND(AVG(cache_hit_rate), 4) as avg_cache_hit_rate,
    ROUND(AVG(error_rate), 4) as avg_error_rate
FROM embedding_generation_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model
ORDER BY total_cost DESC;

-- Fonction pour nettoyer les anciennes statistiques
CREATE OR REPLACE FUNCTION cleanup_old_embedding_stats(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM embedding_generation_log 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Commentaires sur les tables
COMMENT ON TABLE document_chunks IS 'Stocke les fragments de documents avec leurs embeddings vectoriels';
COMMENT ON TABLE document_metadata IS 'Métadonnées enrichies pour les documents indexés';
COMMENT ON TABLE embedding_generation_log IS 'Journal des générations d''embeddings pour le monitoring';
COMMENT ON TABLE cache_statistics IS 'Statistiques de performance du cache d''embeddings';

-- Commentaires sur les colonnes importantes
COMMENT ON COLUMN document_chunks.embedding IS 'Vecteur d''embedding pour la recherche sémantique';
COMMENT ON COLUMN document_chunks.embedding_model IS 'Modèle utilisé pour générer l''embedding';
COMMENT ON COLUMN document_metadata.content_type IS 'Type de contenu: text, code, example, api';
COMMENT ON COLUMN embedding_generation_log.total_cost IS 'Coût total en USD de la génération';
COMMENT ON COLUMN cache_statistics.hit_rate IS 'Taux de succès du cache (0-1)';
