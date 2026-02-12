# E5-Story5-2-Stockage-Vectoriel.md

## Epic 5: Documentation Query Engine

### Story 5.2: Stockage vectoriel

**Description**: Mise en place de la base de données vectorielle avec pgvector

---

## Objectif

Configurer et optimiser une base de données vectorielle performante utilisant PostgreSQL avec l'extension pgvector pour stocker et rechercher efficacement les embeddings de documentation à grande échelle.

---

## Prérequis

- PostgreSQL 14+ avec extension pgvector installée
- Service de génération d'embeddings (Story 5.1) fonctionnel
- Configuration matérielle adaptée (RAM suffisante)
- Scripts de migration et de peuplement

---

## Spécifications Techniques

### 1. Configuration PostgreSQL

#### 1.1 Installation et Configuration

```bash
# Installation de pgvector (Ubuntu/Debian)
sudo apt-get install postgresql-15-pgvector

# Installation depuis les sources (alternative)
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

```sql
-- Configuration PostgreSQL pour pgvector
-- postgresql.conf optimisations

# Memory settings
shared_buffers = 4GB                    # 25% de RAM
effective_cache_size = 12GB             # 75% de RAM
work_mem = 256MB                        # Pour les tris et hash
maintenance_work_mem = 1GB

# Vector specific settings
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
parallel_tuple_cost = 0.1
parallel_setup_cost = 1000.0

# Connection settings
max_connections = 200
shared_preload_libraries = 'vector'

# WAL settings
wal_buffers = 64MB
checkpoint_completion_target = 0.9
```

#### 1.2 Schéma de Base de Données Vectorielle

```sql
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
SELECT cron.schedule('cleanup-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');
```

### 2. Service de Stockage Vectoriel

#### 2.1 Vector Storage Service

```typescript
// src/services/vector-storage.service.ts
import { Pool } from 'pg';
import { VectorSearchQuery, VectorSearchResult, DocumentChunk } from '../types/embeddings.types';

export class VectorStorageService {
  constructor(private db: Pool) {}

  async storeEmbedding(embedding: {
    libraryId: string;
    chunkId: string;
    content: string;
    embedding: number[];
    model: string;
    metadata: any;
    sourceInfo?: any;
  }): Promise<string> {
    const contentHash = this.generateContentHash(embedding.content);
    
    // Vérification de déduplication
    const existing = await this.checkDuplicate(embedding.libraryId, contentHash);
    if (existing) {
      return existing.id;
    }

    const query = `
      INSERT INTO document_embeddings (
        library_id, chunk_id, content, content_hash, embedding,
        embedding_model, metadata, source_url, source_title,
        source_section, source_subsection, file_path,
        line_start, line_end, chunk_index, total_chunks,
        status, indexed_at
      ) VALUES (
        $1, $2, $3, $4, $5::vector,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, NOW()
      )
      RETURNING id
    `;

    const values = [
      embedding.libraryId,
      embedding.chunkId,
      embedding.content,
      contentHash,
      `[${embedding.embedding.join(',')}]`,
      embedding.model,
      JSON.stringify(embedding.metadata),
      embedding.sourceInfo?.url,
      embedding.sourceInfo?.title,
      embedding.sourceInfo?.section,
      embedding.sourceInfo?.subsection,
      embedding.sourceInfo?.filePath,
      embedding.sourceInfo?.lineStart,
      embedding.sourceInfo?.lineEnd,
      embedding.metadata.chunkIndex || 0,
      embedding.metadata.totalChunks || 1,
      'indexed'
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  async batchStoreEmbeddings(embeddings: Array<{
    libraryId: string;
    chunkId: string;
    content: string;
    embedding: number[];
    model: string;
    metadata: any;
    sourceInfo?: any;
  }>): Promise<{ stored: number; duplicates: number; errors: string[] }> {
    const client = await this.db.connect();
    let stored = 0;
    let duplicates = 0;
    const errors: string[] = [];

    try {
      await client.query('BEGIN');

      for (const embedding of embeddings) {
        try {
          const contentHash = this.generateContentHash(embedding.content);
          
          // Vérification rapide de déduplication
          const duplicateCheck = await client.query(
            'SELECT id FROM document_embeddings WHERE library_id = $1 AND content_hash = $2',
            [embedding.libraryId, contentHash]
          );

          if (duplicateCheck.rows.length > 0) {
            duplicates++;
            continue;
          }

          await client.query(`
            INSERT INTO document_embeddings (
              library_id, chunk_id, content, content_hash, embedding,
              embedding_model, metadata, source_url, source_title,
              source_section, source_subsection, file_path,
              line_start, line_end, chunk_index, total_chunks,
              status, indexed_at
            ) VALUES (
              $1, $2, $3, $4, $5::vector,
              $6, $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, NOW()
            )
          `, [
            embedding.libraryId,
            embedding.chunkId,
            embedding.content,
            contentHash,
            `[${embedding.embedding.join(',')}]`,
            embedding.model,
            JSON.stringify(embedding.metadata),
            embedding.sourceInfo?.url,
            embedding.sourceInfo?.title,
            embedding.sourceInfo?.section,
            embedding.sourceInfo?.subsection,
            embedding.sourceInfo?.filePath,
            embedding.sourceInfo?.lineStart,
            embedding.sourceInfo?.lineEnd,
            embedding.metadata.chunkIndex || 0,
            embedding.metadata.totalChunks || 1,
            'indexed'
          ]);

          stored++;
        } catch (error) {
          errors.push(`Error storing chunk ${embedding.chunkId}: ${error.message}`);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { stored, duplicates, errors };
  }

  async vectorSearch(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const startTime = Date.now();
    
    // Génération de l'embedding de requête (supposé déjà fait)
    const queryEmbedding = query.queryEmbedding || [];
    
    // Construction de la requête SQL optimisée
    const sqlQuery = this.buildOptimizedVectorQuery(query);
    
    const params = [
      `[${queryEmbedding.join(',')}]`, // $1: query embedding
      query.threshold || 0.7,          // $2: threshold
      query.limit                      // $3: limit
    ];

    let paramIndex = 4;
    
    // Ajout des filtres dynamiques
    if (query.libraryId) {
      sqlQuery += ` AND de.library_id = $${paramIndex++}`;
      params.push(query.libraryId);
    }

    if (query.filters?.contentType) {
      sqlQuery += ` AND de.metadata->>'contentType' = ANY($${paramIndex++})`;
      params.push(query.filters.contentType);
    }

    if (query.filters?.codeLanguage) {
      sqlQuery += ` AND de.metadata->>'codeLanguage' = ANY($${paramIndex++})`;
      params.push(query.filters.codeLanguage);
    }

    if (query.filters?.section) {
      sqlQuery += ` AND de.source_section = ANY($${paramIndex++})`;
      params.push(query.filters.section);
    }

    sqlQuery += ` ORDER BY similarity DESC, de.last_accessed_at DESC`;

    const result = await this.db.query(sqlQuery, params);
    const searchTime = Date.now() - startTime;

    // Mise à jour des analytics
    await this.updateSearchAnalytics(query, result.rows, searchTime);

    return this.processVectorResults(result.rows, query);
  }

  private buildOptimizedVectorQuery(query: VectorSearchQuery): string {
    // Utilisation de l'index IVFFlat pour la performance
    let sql = `
      SELECT 
        de.id,
        de.library_id,
        de.chunk_id,
        de.content,
        de.metadata,
        de.source_url,
        de.source_title,
        de.source_section,
        de.source_subsection,
        de.file_path,
        de.line_start,
        de.line_end,
        de.chunk_index,
        de.total_chunks,
        de.embedding_model,
        de.created_at,
        de.updated_at,
        1 - (de.embedding <=> $1::vector) as similarity,
        ts_rank_cd(
          to_tsvector('english', de.content),
          plainto_tsquery('english', $4)
        ) as text_rank
      FROM document_embeddings de
      WHERE 1 - (de.embedding <=> $1::vector) >= $2
        AND de.status = 'indexed'
    `;

    // Ajout du texte de la requête pour le ranking hybride
    if (query.queryText) {
      sql = sql.replace('$4', `'${query.queryText}'`);
    } else {
      sql = sql.replace(', ts_rank_cd(...) as text_rank', '');
      sql = sql.replace('plainto_tsquery($4)', 'plainto_tsquery(\'\')');
    }

    return sql;
  }

  private async updateSearchAnalytics(
    query: VectorSearchQuery, 
    results: any[], 
    searchTime: number
  ): Promise<void> {
    // Création de la session de recherche
    const sessionResult = await this.db.query(`
      INSERT INTO search_sessions (
        user_id, query, query_embedding, filters, results_count, search_time_ms
      ) VALUES (
        $1, $2, $3::vector, $4, $5, $6
      ) RETURNING id
    `, [
      query.userId,
      query.query,
      `[${query.queryEmbedding?.join(',') || []}]`,
      JSON.stringify(query.filters || {}),
      results.length,
      searchTime
    ]);

    const sessionId = sessionResult.rows[0].id;

    // Enregistrement des résultats pour analytics
    if (results.length > 0) {
      const analyticsData = results.map((row, index) => `(
        '${sessionId}',
        '${row.library_id}',
        '${row.id}',
        ${index + 1},
        ${row.similarity},
        false,
        NULL
      )`).join(',');

      await this.db.query(`
        INSERT INTO search_analytics (
          session_id, library_id, chunk_id, rank, score, clicked, dwell_time_ms
        ) VALUES ${analyticsData}
      `);
    }
  }

  private processVectorResults(rows: any[], query: VectorSearchResult): VectorSearchResult[] {
    return rows.map(row => {
      const chunk: DocumentChunk = {
        id: row.id,
        libraryId: row.library_id,
        content: row.content,
        metadata: row.metadata,
        url: row.source_url,
        title: row.source_title,
        section: row.source_section,
        subsection: row.source_subsection,
        filePath: row.file_path,
        lineStart: row.line_start,
        lineEnd: row.line_end,
        chunkIndex: row.chunk_index,
        totalChunks: row.total_chunks,
        embeddingModel: row.embedding_model,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      // Score hybride combinant similarité vectorielle et ranking textuel
      const vectorScore = row.similarity;
      const textScore = row.text_rank || 0;
      const hybridScore = (vectorScore * 0.7) + (textScore * 0.3);

      return {
        chunk,
        score: hybridScore,
        relevance: this.calculateRelevance(hybridScore),
        highlights: this.generateHighlights(row.content, query.queryText || '')
      };
    });
  }

  async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    embeddingsByModel: Record<string, number>;
    embeddingsByLibrary: Record<string, number>;
    averageChunkSize: number;
    storageSize: number;
    indexSize: number;
  }> {
    const queries = await Promise.all([
      this.db.query('SELECT COUNT(*) as total FROM document_embeddings'),
      this.db.query('SELECT embedding_model, COUNT(*) as count FROM document_embeddings GROUP BY embedding_model'),
      this.db.query('SELECT library_id, COUNT(*) as count FROM document_embeddings GROUP BY library_id'),
      this.db.query('SELECT AVG(LENGTH(content)) as avg_size FROM document_embeddings'),
      this.db.query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('document_embeddings')) as total_size,
          pg_size_pretty(pg_relation_size('idx_document_embeddings_embedding_ivfflat')) as index_size
      `)
    ]);

    return {
      totalEmbeddings: parseInt(queries[0].rows[0].total),
      embeddingsByModel: queries[1].rows.reduce((acc, row) => {
        acc[row.embedding_model] = parseInt(row.count);
        return acc;
      }, {}),
      embeddingsByLibrary: queries[2].rows.reduce((acc, row) => {
        acc[row.library_id] = parseInt(row.count);
        return acc;
      }, {}),
      averageChunkSize: Math.round(parseFloat(queries[3].rows[0].avg_size)),
      storageSize: queries[4].rows[0].total_size,
      indexSize: queries[4].rows[0].index_size
    };
  }

  async optimizeIndexes(): Promise<void> {
    // Réorganisation des index pour meilleure performance
    await this.db.query('VACUUM ANALYZE document_embeddings');
    
    // Mise à jour des statistiques pour l'optimiseur de requêtes
    await this.db.query('ANALYZE document_embeddings');
    
    // Reconstruction de l'index vectoriel si nécessaire
    const indexStats = await this.db.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE tablename = 'document_embeddings'
    `);

    console.log('Index stats:', indexStats.rows);
  }

  async cleanupOldEmbeddings(daysToKeep: number = 90): Promise<{
    deletedCount: number;
    freedSpace: string;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db.query(`
      WITH deleted AS (
        DELETE FROM document_embeddings 
        WHERE created_at < $1 AND last_accessed_at < $1
        RETURNING id
      )
      SELECT COUNT(*) as count, pg_size_pretty(pg_relation_size('document_embeddings')) as size
      FROM deleted
    `, [cutoffDate]);

    return {
      deletedCount: parseInt(result.rows[0].count),
      freedSpace: result.rows[0].size
    };
  }

  private generateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async checkDuplicate(libraryId: string, contentHash: string): Promise<{ id: string } | null> {
    const result = await this.db.query(
      'SELECT id FROM document_embeddings WHERE library_id = $1 AND content_hash = $2',
      [libraryId, contentHash]
    );

    return result.rows[0] || null;
  }

  private calculateRelevance(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.85) return 'high';
    if (score >= 0.75) return 'medium';
    return 'low';
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      if (queryWords.some(word => lowerSentence.includes(word))) {
        const highlight = sentence.trim().substring(0, 200) + (sentence.length > 200 ? '...' : '');
        highlights.push(highlight);
      }
    }
    
    return highlights.slice(0, 3);
  }
}
```

### 3. Service de Maintenance

#### 3.1 Vector Maintenance Service

```typescript
// src/services/vector-maintenance.service.ts
import { Pool } from 'pg';
import { VectorStorageService } from './vector-storage.service';

export class VectorMaintenanceService {
  constructor(
    private db: Pool,
    private vectorStorage: VectorStorageService
  ) {}

  async performMaintenance(): Promise<{
    optimized: boolean;
    cleaned: boolean;
    reindexed: boolean;
    stats: any;
  }> {
    const results = {
      optimized: false,
      cleaned: false,
      reindexed: false,
      stats: null
    };

    try {
      // 1. Optimisation des index
      await this.vectorStorage.optimizeIndexes();
      results.optimized = true;

      // 2. Nettoyage des anciens embeddings
      const cleanupResult = await this.vectorStorage.cleanupOldEmbeddings(90);
      results.cleaned = cleanupResult.deletedCount > 0;

      // 3. Mise à jour des statistiques
      results.stats = await this.vectorStorage.getEmbeddingStats();

      // 4. Vérification de la nécessité de réindexer
      const shouldReindex = await this.shouldReindex();
      if (shouldReindex) {
        await this.reindexIfNeeded();
        results.reindexed = true;
      }

    } catch (error) {
      console.error('Maintenance error:', error);
    }

    return results;
  }

  private async shouldReindex(): Promise<boolean> {
    // Vérifier si l'index est fragmenté
    const result = await this.db.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('document_embeddings')) as total_size,
        pg_size_pretty(pg_relation_size('idx_document_embeddings_embedding_ivfflat')) as index_size,
        (SELECT COUNT(*) FROM document_embeddings) as total_rows
    `);

    const stats = result.rows[0];
    const totalSize = this.parseSize(stats.total_size);
    const indexSize = this.parseSize(stats.index_size);
    const totalRows = parseInt(stats.total_rows);

    // Réindexer si l'index représente plus de 50% de la taille totale
    // ou si nous avons plus de 1M de rows
    return (indexSize / totalSize > 0.5) || totalRows > 1000000;
  }

  private async reindexIfNeeded(): Promise<void> {
    // Création d'un nouvel index avec des paramètres optimisés
    await this.db.query(`
      CREATE INDEX CONCURRENTLY idx_document_embeddings_embedding_ivfflat_new
      ON document_embeddings 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = LEAST(1000, CEIL(SQRT(SELECT COUNT(*) FROM document_embeddings))))
    `);

    // Remplacement de l'ancien index
    await this.db.query(`
      DROP INDEX CONCURRENTLY idx_document_embeddings_embedding_ivfflat;
      ALTER INDEX idx_document_embeddings_embedding_ivfflat_new 
      RENAME TO idx_document_embeddings_embedding_ivfflat;
    `);
  }

  private parseSize(sizeStr: string): number {
    const units = { 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024 };
    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/);
    
    if (!match) return 0;
    
    const [, value, unit] = match;
    return parseFloat(value) * units[unit as keyof typeof units];
  }

  async getMaintenanceReport(): Promise<{
    databaseSize: string;
    indexSize: string;
    totalEmbeddings: number;
    indexEfficiency: number;
    lastMaintenance: Date;
    recommendations: string[];
  }> {
    const [sizeResult, statsResult] = await Promise.all([
      this.db.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_size_pretty(pg_total_relation_size('document_embeddings')) as table_size,
          pg_size_pretty(pg_relation_size('idx_document_embeddings_embedding_ivfflat')) as index_size
      `),
      this.vectorStorage.getEmbeddingStats()
    ]);

    const dbSize = sizeResult.rows[0].db_size;
    const tableSize = sizeResult.rows[0].table_size;
    const indexSize = sizeResult.rows[0].index_size;
    
    const tableSizeBytes = this.parseSize(tableSize);
    const indexSizeBytes = this.parseSize(indexSize);
    const indexEfficiency = tableSizeBytes > 0 ? indexSizeBytes / tableSizeBytes : 0;

    const recommendations: string[] = [];
    
    if (indexEfficiency > 0.5) {
      recommendations.push('Considérer la reconstruction de l\'index vectoriel');
    }
    
    if (statsResult.totalEmbeddings > 1000000) {
      recommendations.push('Considérer l\'utilisation de HNSW pour de meilleures performances');
    }
    
    if (statsResult.averageChunkSize > 2000) {
      recommendations.push('Les chunks sont peut-être trop grands, considérer un découpage plus fin');
    }

    return {
      databaseSize: dbSize,
      indexSize,
      totalEmbeddings: statsResult.totalEmbeddings,
      indexEfficiency: Math.round(indexEfficiency * 100) / 100,
      lastMaintenance: new Date(), // À récupérer depuis une table de logs
      recommendations
    };
  }
}
```

---

## Tâches Détaillées

### 1. Configuration PostgreSQL
- [ ] Installer pgvector et configurer PostgreSQL
- [ ] Optimiser les paramètres de performance
- [ ] Créer le schéma de base de données
- [ ] Configurer les index vectoriels

### 2. Service de Stockage
- [ ] Développer VectorStorageService
- [ ] Implémenter le stockage batch
- [ ] Ajouter la déduplication
- [ ] Optimiser les requêtes

### 3. Recherche Vectorielle
- [ ] Implémenter la recherche hybride
- [ ] Ajouter les filtres et faceting
- [ ] Optimiser les performances
- [ ] Ajouter les analytics

### 4. Maintenance
- [ ] Développer le service de maintenance
- [ ] Implémenter le nettoyage automatique
- [ ] Ajouter la réindexation
- [ ] Créer les rapports

---

## Validation

### Tests de Stockage

```typescript
// __tests__/vector-storage.service.test.ts
describe('VectorStorageService', () => {
  let service: VectorStorageService;
  let testDb: Pool;

  beforeEach(async () => {
    testDb = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    service = new VectorStorageService(testDb);
  });

  describe('storeEmbedding', () => {
    it('should store embedding successfully', async () => {
      const embedding = {
        libraryId: 'test-lib',
        chunkId: 'chunk-1',
        content: 'Test content',
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        metadata: { contentType: 'text' }
      };

      const id = await service.storeEmbedding(embedding);
      
      expect(id).toBeDefined();
      
      // Vérification en base
      const result = await testDb.query('SELECT * FROM document_embeddings WHERE id = $1', [id]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].content).toBe('Test content');
    });

    it('should handle duplicates correctly', async () => {
      const embedding = {
        libraryId: 'test-lib',
        chunkId: 'chunk-1',
        content: 'Test content',
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        metadata: { contentType: 'text' }
      };

      const id1 = await service.storeEmbedding(embedding);
      const id2 = await service.storeEmbedding(embedding);
      
      expect(id1).toBe(id2); // Même ID pour le duplicate
    });
  });

  describe('vectorSearch', () => {
    it('should return relevant results', async () => {
      // Préparation: insérer des données de test
      await service.storeEmbedding({
        libraryId: 'test-lib',
        chunkId: 'chunk-1',
        content: 'React is a JavaScript library for building user interfaces',
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        metadata: { contentType: 'text' }
      });

      const query = {
        queryEmbedding: new Array(1536).fill(0.1),
        queryText: 'React JavaScript',
        limit: 10,
        threshold: 0.7
      };

      const results = await service.vectorSearch(query);
      
      expect(results).toHaveLength.greaterThan(0);
      expect(results[0].score).toBe.greaterThan(0.7);
    });
  });
});
```

---

## Architecture

### Composants

1. **PostgreSQL + pgvector**: Base de données vectorielle
2. **VectorStorageService**: Service de stockage et recherche
3. **VectorMaintenanceService**: Maintenance et optimisation
4. **Index IVFFlat/HNSW**: Index vectoriels optimisés
5. **Analytics**: Tracking des performances

### Flux de Stockage

```
Document → Embedding → Validation → Storage → Indexing → Analytics
```

---

## Performance

### Optimisations

- **Index IVFFlat**: Pour les grandes datasets
- **Batch Processing**: Stockage par lots optimisé
- **Connection Pooling**: Pool de connexions PostgreSQL
- **Query Optimization**: Requêtes SQL optimisées
- **Hybrid Search**: Combinaison vectorielle + textuelle

### Métriques Cibles

- **Storage Speed**: > 1000 embeddings/second
- **Search Latency**: < 100ms pour 95% des requêtes
- **Index Efficiency**: < 30% de la taille totale
- **Storage Efficiency**: Compression automatique

---

## Monitoring

### Métriques

- `vector.storage.total`: Nombre total d'embeddings
- `vector.storage.size`: Taille de stockage
- `vector.search.latency`: Latence de recherche
- `vector.search.results`: Nombre de résultats par recherche
- `vector.maintenance.last_run`: Dernière maintenance

---

## Livrables

1. **Database Schema**: Tables et index pgvector
2. **VectorStorageService**: Service complet
3. **VectorMaintenanceService**: Maintenance automatisée
4. **Performance Tests**: Benchmarks et optimisations
5. **Monitoring Dashboard**: Métriques et alertes

---

## Critères de Succès

- [ ] Stockage vectoriel fonctionnel
- [ ] Recherche < 100ms
- [ ] Index efficiency < 30%
- [ ] Maintenance automatisée
- [ ] Tests avec couverture > 90%
- [ ] Scalabilité > 1M embeddings

---

## Suivi

### Post-Implémentation

1. **Performance Monitoring**: Surveillance continue
2. **Index Optimization**: Ajustement des paramètres
3. **Storage Planning**: Planification de la croissance
4. **Query Tuning**: Optimisation des requêtes
