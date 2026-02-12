# E5-Story5-1-Generation-Embeddings.md

## Epic 5: Documentation Query Engine

### Story 5.1: Génération d'embeddings

**Description**: Intégration avec OpenAI API pour générer les embeddings

---

## Objectif

Mettre en place un service robuste de génération d'embeddings vectoriels pour la documentation des bibliothèques en utilisant l'API OpenAI, avec gestion du cache, monitoring et optimisation des coûts.

---

## Prérequis

- Clé API OpenAI configurée
- Service de crawling (Epic 6) pour récupérer la documentation
- Base de données vectorielle (Pinecone/Weaviate) ou PostgreSQL avec pgvector
- Redis pour cache des embeddings
- Système de monitoring des coûts

---

## Spécifications Techniques

### 1. Architecture des Embeddings

#### 1.1 Types et Interfaces

```typescript
// src/types/embeddings.types.ts
export interface DocumentChunk {
  id: string;
  libraryId: string;
  content: string;
  metadata: {
    url: string;
    title: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    contentType: 'text' | 'code' | 'example' | 'api';
    position: number;
    totalChunks: number;
    version?: string;
    lastModified: Date;
  };
  embedding?: number[];
  embeddingModel: string;
  embeddingVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingRequest {
  chunks: Array<{
    id: string;
    content: string;
    metadata: DocumentChunk['metadata'];
  }>;
  model?: string;
  batchSize?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  model: string;
  tokens: number;
  cost: number;
  processingTime: number;
}

export interface EmbeddingStats {
  totalChunks: number;
  totalTokens: number;
  totalCost: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  modelUsage: Record<string, number>;
}

export interface VectorSearchQuery {
  query: string;
  libraryId?: string;
  filters?: {
    contentType?: DocumentChunk['metadata']['contentType'][];
    codeLanguage?: string[];
    version?: string;
    section?: string[];
  };
  limit: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export interface VectorSearchResult {
  chunk: DocumentChunk;
  score: number;
  relevance: 'high' | 'medium' | 'low';
  highlights?: string[];
}
```

#### 1.2 Configuration des Modèles

```typescript
// src/config/embeddings.config.ts
export const EMBEDDING_MODELS = {
  'text-embedding-3-small': {
    dimensions: 1536,
    maxTokens: 8191,
    costPer1KTokens: 0.00002,
    speed: 'fast',
    quality: 'good'
  },
  'text-embedding-3-large': {
    dimensions: 3072,
    maxTokens: 8191,
    costPer1KTokens: 0.00013,
    speed: 'medium',
    quality: 'excellent'
  },
  'text-embedding-ada-002': {
    dimensions: 1536,
    maxTokens: 8191,
    costPer1KTokens: 0.00010,
    speed: 'medium',
    quality: 'good'
  }
} as const;

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const BATCH_SIZE_LIMIT = 100;
export const MAX_CONTENT_LENGTH = 8190; // Limite OpenAI
export const EMBEDDING_CACHE_TTL = 86400; // 24 heures
```

### 2. Service de Génération d'Embeddings

#### 2.1 Embedding Generation Service

```typescript
// src/services/embedding-generation.service.ts
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import crypto from 'crypto';

export class EmbeddingGenerationService {
  private openai: OpenAI;
  private rateLimiter: Map<string, number[]> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private config: {
      openaiApiKey: string;
      defaultModel: string;
      maxRetries: number;
      retryDelay: number;
    }
  ) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
      maxRetries: config.maxRetries,
    });
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResult[]> {
    const model = request.model || this.config.defaultModel;
    const batchSize = Math.min(request.batchSize || BATCH_SIZE_LIMIT, BATCH_SIZE_LIMIT);
    
    // Validation des chunks
    const validChunks = this.validateAndPrepareChunks(request.chunks);
    
    // Vérification du cache
    const cachedResults = await this.checkCache(validChunks, model);
    const uncachedChunks = validChunks.filter(chunk => !cachedResults.has(chunk.id));
    
    const results: EmbeddingResult[] = [];
    
    // Traitement par batch pour respecter les limites de l'API
    for (let i = 0; i < uncachedChunks.length; i += batchSize) {
      const batch = uncachedChunks.slice(i, i + batchSize);
      
      try {
        const batchResults = await this.processBatch(batch, model);
        results.push(...batchResults);
        
        // Mise en cache des résultats
        await this.cacheResults(batchResults);
        
        // Pause entre les batches pour respecter les rate limits
        if (i + batchSize < uncachedChunks.length) {
          await this.delay(100);
        }
        
      } catch (error) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, error);
        // Continuer avec le prochain batch en cas d'erreur
      }
    }
    
    // Ajout des résultats du cache
    results.push(...Array.from(cachedResults.values()));
    
    // Logging des statistiques
    await this.logEmbeddingStats(results, model);
    
    return results;
  }

  private validateAndPrepareChunks(chunks: EmbeddingRequest['chunks']): EmbeddingRequest['chunks'] {
    return chunks.filter(chunk => {
      // Validation de la longueur
      if (chunk.content.length > MAX_CONTENT_LENGTH) {
        console.warn(`Chunk ${chunk.id} too long (${chunk.content.length} chars), truncating`);
        chunk.content = chunk.content.substring(0, MAX_CONTENT_LENGTH);
      }
      
      // Validation du contenu
      if (!chunk.content.trim()) {
        console.warn(`Chunk ${chunk.id} is empty, skipping`);
        return false;
      }
      
      return true;
    });
  }

  private async checkCache(
    chunks: EmbeddingRequest['chunks'], 
    model: string
  ): Promise<Map<string, EmbeddingResult>> {
    const cached = new Map<string, EmbeddingResult>();
    
    for (const chunk of chunks) {
      const cacheKey = this.generateCacheKey(chunk.content, model);
      const cachedResult = await this.redis.get(cacheKey);
      
      if (cachedResult) {
        const result = JSON.parse(cachedResult);
        cached.set(chunk.id, result);
      }
    }
    
    return cached;
  }

  private async processBatch(
    batch: EmbeddingRequest['chunks'], 
    model: string
  ): Promise<EmbeddingResult[]> {
    const startTime = Date.now();
    
    try {
      // Rate limiting
      await this.checkRateLimit(model);
      
      const response = await this.openai.embeddings.create({
        model,
        input: batch.map(chunk => chunk.content),
        encoding_format: 'float',
        dimensions: EMBEDDING_MODELS[model as keyof typeof EMBEDDING_MODELS]?.dimensions
      });
      
      const processingTime = Date.now() - startTime;
      
      return response.data.map((embedding, index) => {
        const chunk = batch[index];
        const tokens = this.countTokens(chunk.content);
        const cost = this.calculateCost(tokens, model);
        
        return {
          chunkId: chunk.id,
          embedding: embedding.embedding,
          model,
          tokens,
          cost,
          processingTime: processingTime / batch.length
        };
      });
      
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      if (error instanceof Error && error.message.includes('rate limit')) {
        // Attendre et réessayer
        await this.delay(this.config.retryDelay);
        return this.processBatch(batch, model);
      }
      
      throw error;
    }
  }

  private async cacheResults(results: EmbeddingResult[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const result of results) {
      // Récupérer le contenu original pour le cache key
      const chunk = await this.getChunkById(result.chunkId);
      if (chunk) {
        const cacheKey = this.generateCacheKey(chunk.content, result.model);
        pipeline.setex(cacheKey, EMBEDDING_CACHE_TTL, JSON.stringify(result));
      }
    }
    
    await pipeline.exec();
  }

  private generateCacheKey(content: string, model: string): string {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `embedding:${model}:${hash}`;
  }

  private async checkRateLimit(model: string): Promise<void> {
    const key = `rate_limit:${model}`;
    const now = Date.now();
    const window = 60000; // 1 minute
    const limit = this.getRateLimit(model);
    
    // Nettoyage des anciennes requêtes
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, []);
    }
    
    const requests = this.rateLimiter.get(key)!;
    const validRequests = requests.filter(timestamp => now - timestamp < window);
    this.rateLimiter.set(key, validRequests);
    
    if (validRequests.length >= limit) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = oldestRequest + window - now;
      
      if (waitTime > 0) {
        console.log(`Rate limit reached for ${model}, waiting ${waitTime}ms`);
        await this.delay(waitTime);
      }
    }
    
    validRequests.push(now);
  }

  private getRateLimit(model: string): number {
    const limits = {
      'text-embedding-3-small': 3000,
      'text-embedding-3-large': 3000,
      'text-embedding-ada-002': 3000
    };
    
    return limits[model as keyof typeof limits] || 3000;
  }

  private countTokens(text: string): number {
    // Estimation simple (4 caractères ≈ 1 token)
    return Math.ceil(text.length / 4);
  }

  private calculateCost(tokens: number, model: string): number {
    const modelConfig = EMBEDDING_MODELS[model as keyof typeof EMBEDDING_MODELS];
    if (!modelConfig) return 0;
    
    return (tokens / 1000) * modelConfig.costPer1KTokens;
  }

  private async logEmbeddingStats(results: EmbeddingResult[], model: string): Promise<void> {
    const stats = {
      model,
      chunksProcessed: results.length,
      totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
      totalCost: results.reduce((sum, r) => sum + r.cost, 0),
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      timestamp: new Date()
    };
    
    await this.redis.lpush('embedding_stats', JSON.stringify(stats));
    await this.redis.ltrim('embedding_stats', 0, 999); // Garder les 1000 derniers
  }

  private async getChunkById(chunkId: string): Promise<any> {
    const result = await this.db.query(
      'SELECT content FROM document_chunks WHERE id = $1',
      [chunkId]
    );
    
    return result.rows[0] || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Service de Vector Search

#### 3.1 Vector Search Service

```typescript
// src/services/vector-search.service.ts
import { Pool } from 'pg';
import { EmbeddingGenerationService } from './embedding-generation.service';
import { VectorSearchQuery, VectorSearchResult, DocumentChunk } from '../types/embeddings.types';

export class VectorSearchService {
  constructor(
    private db: Pool,
    private embeddingService: EmbeddingGenerationService
  ) {}

  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    // Génération de l'embedding pour la requête
    const queryEmbedding = await this.generateQueryEmbedding(query.query);
    
    // Construction de la requête SQL de recherche vectorielle
    const sqlQuery = this.buildVectorSearchSQL(query);
    
    // Exécution de la recherche
    const results = await this.db.query(sqlQuery, [
      queryEmbedding,
      query.limit,
      query.threshold || 0.7
    ]);
    
    // Post-traitement des résultats
    return this.processSearchResults(results.rows, query);
  }

  private async generateQueryEmbedding(queryText: string): Promise<number[]> {
    const result = await this.embeddingService.generateEmbeddings({
      chunks: [{
        id: 'query',
        content: queryText,
        metadata: {
          url: '',
          title: 'Query',
          contentType: 'text',
          position: 0,
          totalChunks: 1,
          lastModified: new Date()
        }
      }],
      model: DEFAULT_EMBEDDING_MODEL
    });
    
    return result[0].embedding;
  }

  private buildVectorSearchSQL(query: VectorSearchQuery): string {
    let sql = `
      SELECT 
        dc.*,
        1 - (dc.embedding <=> $1::vector) as similarity,
        dm.title,
        dm.url,
        dm.section,
        dm.subsection
      FROM document_chunks dc
      JOIN document_metadata dm ON dc.library_id = dm.library_id
      WHERE 1 - (dc.embedding <=> $1::vector) >= $3
    `;
    
    const params: any[] = [];
    
    // Filtres
    if (query.libraryId) {
      sql += ` AND dc.library_id = $${params.length + 4}`;
      params.push(query.libraryId);
    }
    
    if (query.filters?.contentType) {
      sql += ` AND dm.content_type = ANY($${params.length + 4})`;
      params.push(query.filters.contentType);
    }
    
    if (query.filters?.codeLanguage) {
      sql += ` AND dm.code_language = ANY($${params.length + 4})`;
      params.push(query.filters.codeLanguage);
    }
    
    if (query.filters?.version) {
      sql += ` AND dm.version = $${params.length + 4}`;
      params.push(query.filters.version);
    }
    
    if (query.filters?.section) {
      sql += ` AND dm.section = ANY($${params.length + 4})`;
      params.push(query.filters.section);
    }
    
    sql += `
      ORDER BY similarity DESC
      LIMIT $2
    `;
    
    return sql;
  }

  private processSearchResults(rows: any[], query: VectorSearchQuery): VectorSearchResult[] {
    return rows.map(row => {
      const chunk: DocumentChunk = {
        id: row.id,
        libraryId: row.library_id,
        content: row.content,
        metadata: {
          url: row.url,
          title: row.title,
          section: row.section,
          subsection: row.subsection,
          contentType: row.content_type,
          position: row.position,
          totalChunks: row.total_chunks,
          version: row.version,
          lastModified: row.last_modified
        },
        embedding: row.embedding,
        embeddingModel: row.embedding_model,
        embeddingVersion: row.embedding_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
      const relevance = this.calculateRelevance(row.similarity);
      const highlights = query.includeMetadata ? this.generateHighlights(chunk.content, query.query) : undefined;
      
      return {
        chunk,
        score: row.similarity,
        relevance,
        highlights
      };
    });
  }

  private calculateRelevance(similarity: number): 'high' | 'medium' | 'low' {
    if (similarity >= 0.85) return 'high';
    if (similarity >= 0.75) return 'medium';
    return 'low';
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    
    // Extraction des phrases contenant les mots de la requête
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      if (queryWords.some(word => lowerSentence.includes(word))) {
        const highlight = sentence.trim().substring(0, 200) + (sentence.length > 200 ? '...' : '');
        highlights.push(highlight);
      }
    }
    
    return highlights.slice(0, 3); // Limiter à 3 highlights
  }
}
```

### 4. Base de Données Vectorielle

#### 4.1 Schéma PostgreSQL avec pgvector

```sql
-- src/db/schema/vector-schema.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Table pour les chunks de documents
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- Pour text-embedding-3-small/ada-002
    metadata JSONB NOT NULL,
    embedding_model VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    position INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les métadonnées des documents
CREATE TABLE document_metadata (
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

-- Index vectoriel pour la recherche rapide
CREATE INDEX idx_document_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index pour les filtres
CREATE INDEX idx_document_chunks_library_id ON document_chunks(library_id);
CREATE INDEX idx_document_chunks_model ON document_chunks(embedding_model);
CREATE INDEX idx_document_metadata_content_type ON document_metadata(content_type);
CREATE INDEX idx_document_metadata_code_language ON document_metadata(code_language);
CREATE INDEX idx_document_metadata_section ON document_metadata(section);

-- Index composite pour les recherches filtrées
CREATE INDEX idx_document_chunks_library_model ON document_chunks(library_id, embedding_model);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_chunks_updated_at
    BEFORE UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_metadata_updated_at
    BEFORE UPDATE ON document_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 5. Monitoring et Analytics

#### 5.1 Embedding Analytics Service

```typescript
// src/services/embedding-analytics.service.ts
import { Redis } from 'ioredis';
import { Pool } from 'pg';

export class EmbeddingAnalyticsService {
  constructor(
    private redis: Redis,
    private db: Pool
  ) {}

  async getEmbeddingStats(timeRange: 'hour' | 'day' | 'week'): Promise<{
    totalChunks: number;
    totalTokens: number;
    totalCost: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    modelUsage: Record<string, number>;
    errorRate: number;
  }> {
    const timeMap = {
      hour: 3600,
      day: 86400,
      week: 604800
    };
    
    const cutoff = Date.now() - (timeMap[timeRange] * 1000);
    
    // Récupération des stats depuis Redis
    const stats = await this.redis.lrange('embedding_stats', 0, -1);
    const filteredStats = stats
      .map(s => JSON.parse(s))
      .filter(s => new Date(s.timestamp).getTime() > cutoff);
    
    if (filteredStats.length === 0) {
      return {
        totalChunks: 0,
        totalTokens: 0,
        totalCost: 0,
        averageProcessingTime: 0,
        cacheHitRate: 0,
        modelUsage: {},
        errorRate: 0
      };
    }
    
    const totalChunks = filteredStats.reduce((sum, s) => sum + s.chunksProcessed, 0);
    const totalTokens = filteredStats.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalCost = filteredStats.reduce((sum, s) => sum + s.totalCost, 0);
    const avgProcessingTime = filteredStats.reduce((sum, s) => sum + s.averageProcessingTime, 0) / filteredStats.length;
    
    // Usage par modèle
    const modelUsage = filteredStats.reduce((acc, s) => {
      acc[s.model] = (acc[s.model] || 0) + s.chunksProcessed;
      return acc;
    }, {} as Record<string, number>);
    
    // Cache hit rate
    const cacheStats = await this.getCacheStats(timeRange);
    
    return {
      totalChunks,
      totalTokens,
      totalCost,
      averageProcessingTime: avgProcessingTime,
      cacheHitRate: cacheStats.hitRate,
      modelUsage,
      errorRate: cacheStats.errorRate
    };
  }

  async getCostForecast(days: number = 30): Promise<{
    estimatedCost: number;
    estimatedTokens: number;
    recommendations: string[];
  }> {
    // Récupération des stats des 7 derniers jours
    const weekStats = await this.getEmbeddingStats('week');
    
    const dailyAverage = {
      tokens: weekStats.totalTokens / 7,
      cost: weekStats.totalCost / 7
    };
    
    const forecast = {
      estimatedCost: dailyAverage.cost * days,
      estimatedTokens: Math.floor(dailyAverage.tokens * days),
      recommendations: this.generateCostRecommendations(weekStats)
    };
    
    return forecast;
  }

  private async getCacheStats(timeRange: string): Promise<{ hitRate: number; errorRate: number }> {
    // Implémentation pour récupérer les stats de cache
    const cacheKey = `cache_stats:${timeRange}`;
    const cached = await this.redis.hgetall(cacheKey);
    
    return {
      hitRate: parseFloat(cached.hitRate || '0'),
      errorRate: parseFloat(cached.errorRate || '0')
    };
  }

  private generateCostRecommendations(stats: any): string[] {
    const recommendations: string[] = [];
    
    if (stats.totalCost > 10) {
      recommendations.push('Considérer l\'utilisation du modèle text-embedding-3-small pour réduire les coûts');
    }
    
    if (stats.cacheHitRate < 0.5) {
      recommendations.push('Augmenter la durée du cache pour améliorer le hit rate');
    }
    
    if (stats.modelUsage['text-embedding-3-large'] > 0.3) {
      recommendations.push('Réserver le modèle large uniquement pour les contenus critiques');
    }
    
    return recommendations;
  }
}
```

---

## Tâches Détaillées

### 1. Configuration OpenAI
- [ ] Configurer le client OpenAI avec authentification
- [ ] Définir les modèles et limites d'utilisation
- [ ] Implémenter le rate limiting
- [ ] Configurer la gestion des erreurs

### 2. Service de Génération
- [ ] Développer EmbeddingGenerationService
- [ ] Implémenter le traitement par batch
- [ ] Ajouter le cache Redis
- [ ] Optimiser les performances

### 3. Base de Données Vectorielle
- [ ] Configurer pgvector sur PostgreSQL
- [ ] Créer les tables et index
- [ ] Implémenter la recherche vectorielle
- [ ] Optimiser les requêtes

### 4. Monitoring et Analytics
- [ ] Développer le service d'analytics
- [ ] Implémenter le suivi des coûts
- [ ] Ajouter les alertes de budget
- [ ] Créer les tableaux de bord

---

## Validation

### Tests du Service

```typescript
// __tests__/embedding-generation.service.test.ts
describe('EmbeddingGenerationService', () => {
  let service: EmbeddingGenerationService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    mockOpenAI = {
      embeddings: {
        create: jest.fn()
      }
    } as any;
    
    service = new EmbeddingGenerationService(
      mockDb,
      mockRedis,
      {
        openaiApiKey: 'test-key',
        defaultModel: 'text-embedding-3-small',
        maxRetries: 3,
        retryDelay: 1000
      }
    );
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for valid chunks', async () => {
      const request = {
        chunks: [{
          id: 'test-chunk',
          content: 'This is a test chunk',
          metadata: {
            url: 'test.com',
            title: 'Test',
            contentType: 'text',
            position: 0,
            totalChunks: 1,
            lastModified: new Date()
          }
        }]
      };

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      });

      const results = await service.generateEmbeddings(request);

      expect(results).toHaveLength(1);
      expect(results[0].chunkId).toBe('test-chunk');
      expect(results[0].embedding).toHaveLength(1536);
    });

    it('should handle rate limiting gracefully', async () => {
      // Simulation de rate limit
      mockOpenAI.embeddings.create.mockRejectedValueOnce(
        new Error('Rate limit exceeded')
      );

      const request = {
        chunks: [{
          id: 'test-chunk',
          content: 'Test content',
          metadata: {
            url: 'test.com',
            title: 'Test',
            contentType: 'text',
            position: 0,
            totalChunks: 1,
            lastModified: new Date()
          }
        }]
      };

      // Après le retry, ça devrait fonctionner
      mockOpenAI.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      });

      const results = await service.generateEmbeddings(request);

      expect(results).toHaveLength(1);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });
  });
});
```

---

## Architecture

### Composants

1. **EmbeddingGenerationService**: Génération des embeddings avec OpenAI
2. **VectorSearchService**: Recherche vectorielle dans la base
3. **EmbeddingAnalyticsService**: Monitoring et coûts
4. **PostgreSQL + pgvector**: Stockage vectoriel
5. **Redis**: Cache des embeddings

### Flux de Génération

```
Document → Chunking → Cache Check → OpenAI API → Embedding → Cache → Database
```

---

## Performance

### Optimisations

- **Batch Processing**: Traitement par lots pour optimiser l'API
- **Caching Stratégique**: Cache Redis avec TTL adaptatif
- **Rate Limiting**: Gestion intelligente des limites d'API
- **Async Processing**: File d'attente pour les gros volumes

### Métriques Cibles

- **Generation Speed**: > 100 chunks/second
- **Cache Hit Rate**: > 80%
- **API Efficiency**: < 5% d'erreurs
- **Cost Optimization**: < $0.01 per 1000 chunks

---

## Monitoring

### Métriques

- `embedding.requests.total`: Nombre de requêtes
- `embedding.tokens.total`: Tokens consommés
- `embedding.cost.total`: Coûts accumulés
- `embedding.cache.hit_rate`: Taux de cache hits
- `embedding.errors.rate`: Taux d'erreurs

### Alertes

- Coût quotidien > $10
- Taux d'erreurs > 5%
- Cache hit rate < 70%
- Latence > 5 secondes

---

## Livrables

1. **EmbeddingGenerationService**: Service complet
2. **VectorSearchService**: Recherche vectorielle
3. **Database Schema**: Tables et index pgvector
4. **Analytics Dashboard**: Monitoring des coûts
5. **API Documentation**: Guide d'utilisation

---

## Critères de Succès

- [ ] Génération d'embeddings fonctionnelle
- [ ] Cache hit rate > 80%
- [ ] Recherche vectorielle < 100ms
- [ ] Monitoring des coûts opérationnel
- [ ] Tests avec couverture > 90%
- [ ] Documentation complète

---

## Suivi

### Post-Implémentation

1. **Cost Monitoring**: Surveillance quotidienne des coûts
2. **Performance Tuning**: Optimisation des batch sizes
3. **Cache Optimization**: Ajustement des TTL
4. **Model Evaluation**: Test des différents modèles
