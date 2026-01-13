# Story 1.3: Configuration de l'infrastructure de vector store

**Epic**: 1 - Infrastructure Core et Foundation  
**Story**: 1.3: Configuration de l'infrastructure de vector store  
**Estimation**: 3-4 jours  
**Priorité**: Critique  

---

## Objectif

Configurer Pinecone ou Qdrant pour le stockage et la recherche vectorielle des embeddings de documentation, avec index optimisé pour la recherche sémantique.

---

## Prérequis

- Story 1.1 et 1.2 complétées
- Compte Pinecone ou instance Qdrant disponible
- Clé API OpenAI pour les embeddings (optionnel pour tests)

---

## Étapes Détaillées

### Étape 1: Choix et installation du vector store

**Action**: Analyser et choisir entre Pinecone et Qdrant, puis installer le client

```bash
# Installer les deux clients pour pouvoir comparer
npm install @pinecone-database/pinecone qdrant-js
npm install --save-dev @types/node

# Installer OpenAI pour les embeddings
npm install openai
```

**Configuration dans .env**:
```bash
# Vector Store Choice (pinecone ou qdrant)
VECTOR_STORE_PROVIDER=pinecone

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=twinmcp-docs

# Qdrant Configuration  
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key

# OpenAI Configuration (pour embeddings)
OPENAI_API_KEY=your_openai_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Docker Compose pour Qdrant local**:
```yaml
# Ajouter à docker-compose.yml
  qdrant:
    image: qdrant/qdrant:latest
    container_name: twinmcp-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      QDRANT__SERVICE__HTTP_PORT: 6333
      QDRANT__SERVICE__GRPC_PORT: 6334
    networks:
      - twinmcp-network

volumes:
  qdrant_data:
```

### Étape 2: Configuration du client Pinecone

**Action**: Créer le service Pinecone avec gestion d'erreurs

**src/config/pinecone.ts**:
```typescript
import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger';

export interface VectorMetadata {
  libraryId: string;
  version: string;
  contentType: 'snippet' | 'guide' | 'api_ref';
  sourceUrl: string;
  chunkText: string;
  section?: string;
  subsection?: string;
  codeLanguage?: string;
  tokenCount: number;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export class PineconeService {
  private client: Pinecone;
  private indexName: string;
  private index: any;

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }

    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp',
    });

    this.indexName = process.env.PINECONE_INDEX_NAME || 'twinmcp-docs';
  }

  async initialize(): Promise<void> {
    try {
      // Vérifier si l'index existe
      const existingIndexes = await this.client.listIndexes();
      const indexExists = existingIndexes.indexes?.some(
        (index: any) => index.name === this.indexName
      );

      if (!indexExists) {
        logger.info(`Creating Pinecone index: ${this.indexName}`);
        
        // Créer l'index avec les bonnes dimensions
        await this.client.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI text-embedding-3-small
          metric: 'cosine',
          podType: 'p1.x1', // Commencer petit
        });

        // Attendre que l'index soit prêt
        await this.waitForIndexReady();
      }

      this.index = this.client.Index(this.indexName);
      logger.info('Pinecone service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const description = await this.client.describeIndex(this.indexName);
        if (description.status?.ready) {
          logger.info('Pinecone index is ready');
          return;
        }
        
        logger.info('Waiting for Pinecone index to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.warn('Error checking index status:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Pinecone index failed to become ready');
  }

  async upsert(vectors: VectorRecord[]): Promise<void> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const pineconeRecords: PineconeRecord[] = vectors.map(vector => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata,
      }));

      // Pinecone a une limite de 1000 vectors par upsert
      const batchSize = 1000;
      for (let i = 0; i < pineconeRecords.length; i += batchSize) {
        const batch = pineconeRecords.slice(i, i + batchSize);
        await this.index.upsert(batch);
        
        logger.debug(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pineconeRecords.length / batchSize)}`);
      }

      logger.info(`Upserted ${vectors.length} vectors to Pinecone`);
    } catch (error) {
      logger.error('Error upserting vectors to Pinecone:', error);
      throw error;
    }
  }

  async query(
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<VectorRecord[]> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const queryRequest: any = {
        vector: queryVector,
        topK,
        includeMetadata: true,
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      const response = await this.index.query(queryRequest);

      const results: VectorRecord[] = response.matches?.map((match: any) => ({
        id: match.id,
        values: match.values || [],
        metadata: match.metadata as VectorMetadata,
        score: match.score,
      })) || [];

      logger.debug(`Query returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('Error querying Pinecone:', error);
      throw error;
    }
  }

  async delete(vectorIds: string[]): Promise<void> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      await this.index.delete1(vectorIds);
      logger.info(`Deleted ${vectorIds.length} vectors from Pinecone`);
    } catch (error) {
      logger.error('Error deleting vectors from Pinecone:', error);
      throw error;
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      await this.index.delete1(filter);
      logger.info('Deleted vectors by filter from Pinecone');
    } catch (error) {
      logger.error('Error deleting vectors by filter from Pinecone:', error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      logger.error('Error getting Pinecone stats:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.index) {
        return false;
      }

      await this.index.describeIndexStats();
      return true;
    } catch (error) {
      logger.error('Pinecone health check failed:', error);
      return false;
    }
  }
}
```

### Étape 3: Configuration du client Qdrant

**Action**: Créer le service Qdrant comme alternative

**src/config/qdrant.ts**:
```typescript
import { QdrantClient } from 'qdrant-js';
import { logger } from '../utils/logger';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    libraryId: string;
    version: string;
    contentType: 'snippet' | 'guide' | 'api_ref';
    sourceUrl: string;
    chunkText: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    tokenCount: number;
  };
}

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;

  constructor() {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = process.env.QDRANT_API_KEY;

    this.client = new QdrantClient({
      url,
      apiKey,
    });

    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'twinmcp-docs';
  }

  async initialize(): Promise<void> {
    try {
      // Vérifier si la collection existe
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections?.some(
        (collection: any) => collection.name === this.collectionName
      );

      if (!collectionExists) {
        logger.info(`Creating Qdrant collection: ${this.collectionName}`);
        
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1536, // OpenAI text-embedding-3-small
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        logger.info('Qdrant collection created successfully');
      }

      logger.info('Qdrant service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Qdrant:', error);
      throw error;
    }
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    try {
      // Qdrant a une limite de 1000 points par upsert
      const batchSize = 1000;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.client.upsert(this.collectionName, {
          points: batch,
        });
        
        logger.debug(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
      }

      logger.info(`Upserted ${points.length} points to Qdrant`);
    } catch (error) {
      logger.error('Error upserting points to Qdrant:', error);
      throw error;
    }
  }

  async query(
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<QdrantPoint[]> {
    try {
      const queryRequest: any = {
        vector: {
          name: '', // vector par défaut
          vector: queryVector,
        },
        limit: topK,
        with_payload: true,
        with_vector: false,
      };

      if (filter) {
        queryRequest.filter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }

      const response = await this.client.search(this.collectionName, queryRequest);

      const results: QdrantPoint[] = response.result?.map((point: any) => ({
        id: point.id,
        vector: point.vector || [],
        payload: point.payload,
        score: point.score,
      })) || [];

      logger.debug(`Query returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('Error querying Qdrant:', error);
      throw error;
    }
  }

  async delete(pointIds: string[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        points: pointIds,
      });
      logger.info(`Deleted ${pointIds.length} points from Qdrant`);
    } catch (error) {
      logger.error('Error deleting points from Qdrant:', error);
      throw error;
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      const qdrantFilter = {
        must: Object.entries(filter).map(([key, value]) => ({
          key,
          match: { value },
        })),
      };

      await this.client.delete(this.collectionName, {
        filter: qdrantFilter,
      });
      logger.info('Deleted points by filter from Qdrant');
    } catch (error) {
      logger.error('Error deleting points by filter from Qdrant:', error);
      throw error;
    }
  }

  async getCollectionInfo(): Promise<any> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return info.result;
    } catch (error) {
      logger.error('Error getting Qdrant collection info:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      logger.error('Qdrant health check failed:', error);
      return false;
    }
  }
}
```

### Étape 4: Service d'embeddings

**Action**: Créer le service pour générer les embeddings avec OpenAI

**src/services/embeddings.service.ts**:
```typescript
import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

export class EmbeddingsService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Vérifier le cache d'abord
      const cacheKey = `embedding:${this.hashText(text)}`;
      const cached = await CacheService.get<number[]>(cacheKey);
      if (cached) {
        logger.debug('Embedding cache hit');
        return cached;
      }

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text.trim(),
      });

      const embedding = response.data[0].embedding;

      // Mettre en cache pour 24 heures
      await CacheService.set(cacheKey, embedding, 86400);

      logger.debug(`Generated embedding for text (${text.length} chars)`);
      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI supporte jusqu'à 2048 inputs par batch
      const batchSize = 2048;
      const allEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        // Vérifier le cache pour chaque texte
        const uncachedTexts: string[] = [];
        const uncachedIndices: number[] = [];
        
        batch.forEach((text, index) => {
          const cacheKey = `embedding:${this.hashText(text)}`;
          // Pour l'instant, on ne vérifie pas le cache en batch pour simplifier
          uncachedTexts.push(text);
          uncachedIndices.push(i + index);
        });

        if (uncachedTexts.length > 0) {
          const response = await this.openai.embeddings.create({
            model: this.model,
            input: uncachedTexts,
          });

          // Mettre en cache les résultats
          for (let j = 0; j < response.data.length; j++) {
            const embedding = response.data[j].embedding;
            const text = uncachedTexts[j];
            const cacheKey = `embedding:${this.hashText(text)}`;
            
            await CacheService.set(cacheKey, embedding, 86400);
            allEmbeddings[uncachedIndices[j]] = embedding;
          }
        }
      }

      logger.info(`Generated batch embeddings for ${texts.length} texts`);
      return allEmbeddings;
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  async generateEmbeddingWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateEmbedding(text);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Embedding generation attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private hashText(text: string): string {
    // Hash simple pour le cache (en production, utiliser crypto)
    return Buffer.from(text).toString('base64').substring(0, 32);
  }

  async getEmbeddingInfo(): Promise<{ model: string; dimensions: number }> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: 'test',
      });

      return {
        model: this.model,
        dimensions: response.data[0].embedding.length,
      };
    } catch (error) {
      logger.error('Error getting embedding info:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.generateEmbedding('health check');
      return true;
    } catch (error) {
      logger.error('Embeddings service health check failed:', error);
      return false;
    }
  }
}
```

### Étape 5: Service vector store unifié

**Action**: Créer une interface unifiée pour les deux providers

**src/services/vector-store.service.ts**:
```typescript
import { PineconeService, VectorRecord } from '../config/pinecone';
import { QdrantService, QdrantPoint } from '../config/qdrant';
import { EmbeddingsService } from './embeddings.service';
import { logger } from '../utils/logger';

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: {
    libraryId: string;
    version: string;
    contentType: 'snippet' | 'guide' | 'api_ref';
    sourceUrl: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    tokenCount: number;
  };
  score: number;
}

export class VectorStoreService {
  private pineconeService: PineconeService;
  private qdrantService: QdrantService;
  private embeddingsService: EmbeddingsService;
  private provider: 'pinecone' | 'qdrant';

  constructor() {
    this.provider = (process.env.VECTOR_STORE_PROVIDER as 'pinecone' | 'qdrant') || 'pinecone';
    
    this.pineconeService = new PineconeService();
    this.qdrantService = new QdrantService();
    this.embeddingsService = new EmbeddingsService();
  }

  async initialize(): Promise<void> {
    try {
      await this.embeddingsService.healthCheck();

      if (this.provider === 'pinecone') {
        await this.pineconeService.initialize();
      } else {
        await this.qdrantService.initialize();
      }

      logger.info(`Vector store service initialized with ${this.provider}`);
    } catch (error) {
      logger.error('Failed to initialize vector store service:', error);
      throw error;
    }
  }

  async addDocument(
    content: string,
    metadata: {
      libraryId: string;
      version: string;
      contentType: 'snippet' | 'guide' | 'api_ref';
      sourceUrl: string;
      section?: string;
      subsection?: string;
      codeLanguage?: string;
      tokenCount: number;
    }
  ): Promise<string> {
    try {
      const embedding = await this.embeddingsService.generateEmbedding(content);
      const id = this.generateId(metadata);

      if (this.provider === 'pinecone') {
        await this.pineconeService.upsert([{
          id,
          values: embedding,
          metadata: {
            ...metadata,
            chunkText: content,
          },
        }]);
      } else {
        await this.qdrantService.upsert([{
          id,
          vector: embedding,
          payload: {
            ...metadata,
            chunkText: content,
          },
        }]);
      }

      logger.debug(`Added document to vector store: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding document to vector store:', error);
      throw error;
    }
  }

  async addDocumentsBatch(
    documents: Array<{
      content: string;
      metadata: {
        libraryId: string;
        version: string;
        contentType: 'snippet' | 'guide' | 'api_ref';
        sourceUrl: string;
        section?: string;
        subsection?: string;
        codeLanguage?: string;
        tokenCount: number;
      };
    }>
  ): Promise<string[]> {
    try {
      const contents = documents.map(doc => doc.content);
      const embeddings = await this.embeddingsService.generateBatchEmbeddings(contents);

      const vectors = documents.map((doc, index) => {
        const id = this.generateId(doc.metadata);
        
        if (this.provider === 'pinecone') {
          return {
            id,
            values: embeddings[index],
            metadata: {
              ...doc.metadata,
              chunkText: doc.content,
            },
          } as VectorRecord;
        } else {
          return {
            id,
            vector: embeddings[index],
            payload: {
              ...doc.metadata,
              chunkText: doc.content,
            },
          } as QdrantPoint;
        }
      });

      if (this.provider === 'pinecone') {
        await this.pineconeService.upsert(vectors as VectorRecord[]);
      } else {
        await this.qdrantService.upsert(vectors as QdrantPoint[]);
      }

      const ids = documents.map(doc => this.generateId(doc.metadata));
      logger.info(`Added ${documents.length} documents to vector store`);
      return ids;
    } catch (error) {
      logger.error('Error adding documents batch to vector store:', error);
      throw error;
    }
  }

  async search(
    query: string,
    options: {
      topK?: number;
      libraryId?: string;
      version?: string;
      contentType?: 'snippet' | 'guide' | 'api_ref';
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const queryVector = await this.embeddingsService.generateEmbedding(query);
      const topK = options.topK || 10;

      // Construire le filtre
      const filter: Record<string, any> = {};
      if (options.libraryId) filter.libraryId = options.libraryId;
      if (options.version) filter.version = options.version;
      if (options.contentType) filter.contentType = options.contentType;

      let results;
      if (this.provider === 'pinecone') {
        results = await this.pineconeService.query(queryVector, topK, filter);
      } else {
        results = await this.qdrantService.query(queryVector, topK, filter);
      }

      return results.map(result => ({
        id: result.id,
        content: result.metadata.chunkText,
        metadata: {
          libraryId: result.metadata.libraryId,
          version: result.metadata.version,
          contentType: result.metadata.contentType,
          sourceUrl: result.metadata.sourceUrl,
          section: result.metadata.section,
          subsection: result.metadata.subsection,
          codeLanguage: result.metadata.codeLanguage,
          tokenCount: result.metadata.tokenCount,
        },
        score: result.score || 0,
      }));
    } catch (error) {
      logger.error('Error searching vector store:', error);
      throw error;
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    try {
      if (this.provider === 'pinecone') {
        await this.pineconeService.delete(ids);
      } else {
        await this.qdrantService.delete(ids);
      }

      logger.info(`Deleted ${ids.length} documents from vector store`);
    } catch (error) {
      logger.error('Error deleting documents from vector store:', error);
      throw error;
    }
  }

  async deleteByLibrary(libraryId: string): Promise<void> {
    try {
      if (this.provider === 'pinecone') {
        await this.pineconeService.deleteByFilter({ libraryId });
      } else {
        await this.qdrantService.deleteByFilter({ libraryId });
      }

      logger.info(`Deleted all documents for library: ${libraryId}`);
    } catch (error) {
      logger.error('Error deleting documents by library:', error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      if (this.provider === 'pinecone') {
        return await this.pineconeService.getStats();
      } else {
        return await this.qdrantService.getCollectionInfo();
      }
    } catch (error) {
      logger.error('Error getting vector store stats:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const embeddingsHealthy = await this.embeddingsService.healthCheck();
      
      let vectorStoreHealthy = false;
      if (this.provider === 'pinecone') {
        vectorStoreHealthy = await this.pineconeService.healthCheck();
      } else {
        vectorStoreHealthy = await this.qdrantService.healthCheck();
      }

      return embeddingsHealthy && vectorStoreHealthy;
    } catch (error) {
      logger.error('Vector store service health check failed:', error);
      return false;
    }
  }

  private generateId(metadata: {
    libraryId: string;
    version: string;
    sourceUrl: string;
    section?: string;
  }): string {
    const parts = [
      metadata.libraryId,
      metadata.version,
      metadata.sourceUrl,
      metadata.section || '',
    ].filter(Boolean);
    
    return parts.join(':').replace(/[^a-zA-Z0-9:-]/g, '_');
  }
}
```

### Étape 6: Tests du vector store

**Action**: Créer les tests complets pour le service vector store

**src/test/vector-store.test.ts**:
```typescript
import { VectorStoreService } from '../services/vector-store.service';
import { EmbeddingsService } from '../services/embeddings.service';

describe('Vector Store Service', () => {
  let vectorStoreService: VectorStoreService;
  let embeddingsService: EmbeddingsService;

  beforeAll(async () => {
    vectorStoreService = new VectorStoreService();
    embeddingsService = new EmbeddingsService();
    
    // Skip tests si pas de clé API
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Skipping vector store tests - no OpenAI API key');
      return;
    }

    await vectorStoreService.initialize();
  });

  afterAll(async () => {
    // Nettoyer les données de test si nécessaire
  });

  describe('Embeddings Service', () => {
    it('should generate embedding for text', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const text = 'This is a test document for embedding generation';
      const embedding = await embeddingsService.generateEmbedding(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536); // OpenAI text-embedding-3-small
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should generate batch embeddings', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const texts = [
        'First test document',
        'Second test document',
        'Third test document',
      ];

      const embeddings = await embeddingsService.generateBatchEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(1536);
        expect(embedding.every(val => typeof val === 'number')).toBe(true);
      });
    });

    it('should cache embeddings', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const text = 'Cache test document';
      
      // Premier appel
      const start1 = Date.now();
      const embedding1 = await embeddingsService.generateEmbedding(text);
      const time1 = Date.now() - start1;

      // Deuxième appel (devrait être plus rapide)
      const start2 = Date.now();
      const embedding2 = await embeddingsService.generateEmbedding(text);
      const time2 = Date.now() - start2;

      expect(embedding1).toEqual(embedding2);
      expect(time2).toBeLessThan(time1); // Cache devrait être plus rapide
    });
  });

  describe('Vector Store Operations', () => {
    const testMetadata = {
      libraryId: '/test/library',
      version: '1.0.0',
      contentType: 'guide' as const,
      sourceUrl: 'https://example.com/doc',
      section: 'Introduction',
      tokenCount: 100,
    };

    it('should add document to vector store', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const content = 'This is a test document for vector store';
      const id = await vectorStoreService.addDocument(content, testMetadata);

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should search documents', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      // Ajouter un document de test
      await vectorStoreService.addDocument(
        'MongoDB is a NoSQL database that stores data in flexible documents',
        {
          ...testMetadata,
          libraryId: '/mongodb/docs',
        }
      );

      // Rechercher
      const results = await vectorStoreService.search('MongoDB database', {
        topK: 5,
        libraryId: '/mongodb/docs',
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('score');
        expect(result.metadata.libraryId).toBe('/mongodb/docs');
      });
    });

    it('should filter search results', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      // Ajouter des documents de différents types
      await vectorStoreService.addDocument(
        'Code snippet example',
        {
          ...testMetadata,
          libraryId: '/test/snippets',
          contentType: 'snippet',
        }
      );

      await vectorStoreService.addDocument(
        'API reference documentation',
        {
          ...testMetadata,
          libraryId: '/test/api',
          contentType: 'api_ref',
        }
      );

      // Rechercher par type
      const snippetResults = await vectorStoreService.search('example', {
        topK: 10,
        contentType: 'snippet',
      });

      expect(snippetResults.every(r => r.metadata.contentType === 'snippet')).toBe(true);
    });

    it('should delete documents', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      // Ajouter un document
      const content = 'Document to delete';
      const id = await vectorStoreService.addDocument(content, testMetadata);

      // Supprimer
      await vectorStoreService.deleteDocuments([id]);

      // Vérifier qu'il n'est plus trouvé
      const results = await vectorStoreService.search('delete', {
        topK: 10,
      });

      const deletedDoc = results.find(r => r.id === id);
      expect(deletedDoc).toBeUndefined();
    });
  });

  describe('Health Checks', () => {
    it('should pass health check', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const isHealthy = await vectorStoreService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should get stats', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const stats = await vectorStoreService.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });
});
```

### Étape 7: Scripts de gestion

**Action**: Créer des scripts pour la gestion du vector store

**scripts/vector-store-setup.ts**:
```typescript
import { VectorStoreService } from '../src/services/vector-store.service';

async function setupVectorStore() {
  console.log('Setting up vector store...');

  try {
    const vectorStore = new VectorStoreService();
    await vectorStore.initialize();

    // Vérifier le health check
    const isHealthy = await vectorStore.healthCheck();
    console.log('Vector store health:', isHealthy);

    // Obtenir les stats
    const stats = await vectorStore.getStats();
    console.log('Vector store stats:', JSON.stringify(stats, null, 2));

    console.log('Vector store setup completed!');
  } catch (error) {
    console.error('Vector store setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupVectorStore();
}
```

**Scripts package.json**:
```json
{
  "scripts": {
    "vector:setup": "ts-node scripts/vector-store-setup.ts",
    "vector:test": "npm test -- --testPathPattern=vector-store",
    "vector:health": "ts-node -e \"import('./src/services/vector-store.service').then(s => new s.VectorStoreService().healthCheck().then(h => console.log('Healthy:', h)))\""
  }
}
```

---

## Critères d'Achèvement

- [ ] Vector store (Pinecone ou Qdrant) configuré et accessible
- [ ] Service d'embeddings OpenAI fonctionnel
- [ ] Service vector store unifié opérationnel
- [ ] Tests unitaires passants
- [ ] Health checks implémentés
- [ ] Scripts de gestion créés
- [ ] Cache des embeddings fonctionnel
- [ ] Gestion d'erreurs robuste

---

## Tests de Validation

```bash
# 1. Démarrer Qdrant (si utilisé)
npm run docker:up

# 2. Configurer les variables d'environnement
# Copier .env.example vers .env et configurer

# 3. Initialiser le vector store
npm run vector:setup

# 4. Exécuter les tests
npm run vector:test

# 5. Health check
npm run vector:health
```

---

## Risques et Mitigations

**Risque**: Clé API OpenAI expirée ou limitée  
**Mitigation**: Implémenter retry logic et fallback vers modèles locaux

**Risque**: Coût des embeddings OpenAI  
**Mitigation**: Cache agressif et modèles plus petits pour le développement

**Risque**: Vector store indisponible  
**Mitigation**: Health checks et fallback vers recherche textuelle

---

## Prochaine Étape

Passer à **Story 1.4: Stockage objet (S3/MinIO)** pour compléter l'infrastructure de stockage.
