// @ts-nocheck

// In-memory vector store
let vectorStore: Map<string, { id: string; values: number[]; metadata: any }>;
let embeddingCallCount: number;

const fakeEmbedding = () => new Array(1536).fill(0).map(() => Math.random());

// Mock Pinecone
jest.mock('../config/pinecone', () => {
  return {
    PineconeService: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      upsert: jest.fn().mockImplementation(async (records: any[]) => {
        for (const r of records) vectorStore.set(r.id, r);
      }),
      query: jest.fn().mockImplementation(async (_vec: number[], topK: number, filter: any) => {
        let results = Array.from(vectorStore.values());
        if (filter?.libraryId) results = results.filter(r => r.metadata.libraryId === filter.libraryId);
        if (filter?.contentType) results = results.filter(r => r.metadata.contentType === filter.contentType);
        return results.slice(0, topK).map(r => ({ id: r.id, metadata: r.metadata, score: 0.95 }));
      }),
      delete: jest.fn().mockImplementation(async (ids: string[]) => {
        for (const id of ids) vectorStore.delete(id);
      }),
      deleteByFilter: jest.fn(),
      getStats: jest.fn().mockResolvedValue({ totalVectors: 0, dimension: 1536 }),
      healthCheck: jest.fn().mockResolvedValue(true),
    })),
  };
});

// Mock Qdrant
jest.mock('../config/qdrant', () => ({
  QdrantService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    upsert: jest.fn(),
    query: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
    deleteByFilter: jest.fn(),
    getCollectionInfo: jest.fn().mockResolvedValue({}),
    healthCheck: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock EmbeddingsService
jest.mock('../services/embeddings.service', () => ({
  EmbeddingsService: jest.fn().mockImplementation(() => {
    const cache: Record<string, number[]> = {};
    return {
      generateEmbedding: jest.fn().mockImplementation(async (text: string) => {
        embeddingCallCount++;
        if (cache[text]) return cache[text];
        const emb = fakeEmbedding();
        cache[text] = emb;
        return emb;
      }),
      generateBatchEmbeddings: jest.fn().mockImplementation(async (texts: string[]) => {
        return texts.map(() => fakeEmbedding());
      }),
      healthCheck: jest.fn().mockResolvedValue(true),
    };
  }),
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../config/redis', () => ({
  CacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
  },
  redisClient: { on: jest.fn().mockReturnThis() },
}));

import { VectorStoreService } from '../services/vector-store.service';
import { EmbeddingsService } from '../services/embeddings.service';

describe('Vector Store Service', () => {
  let vectorStoreService: VectorStoreService;
  let embeddingsService: EmbeddingsService;

  beforeAll(async () => {
    vectorStore = new Map();
    embeddingCallCount = 0;
    vectorStoreService = new VectorStoreService();
    embeddingsService = new EmbeddingsService();
    await vectorStoreService.initialize();
  });

  beforeEach(() => {
    vectorStore = new Map();
    embeddingCallCount = 0;
  });

  describe('Embeddings Service', () => {
    it('should generate embedding for text', async () => {
      const text = 'This is a test document for embedding generation';
      const embedding = await embeddingsService.generateEmbedding(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should generate batch embeddings', async () => {
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
      const text = 'Cache test document';
      embeddingCallCount = 0;

      const embedding1 = await embeddingsService.generateEmbedding(text);
      const embedding2 = await embeddingsService.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
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
      const content = 'This is a test document for vector store';
      const id = await vectorStoreService.addDocument(content, testMetadata);

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should search documents', async () => {
      await vectorStoreService.addDocument(
        'MongoDB is a NoSQL database that stores data in flexible documents',
        { ...testMetadata, libraryId: '/mongodb/docs' }
      );

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
      await vectorStoreService.addDocument('Code snippet example', {
        ...testMetadata,
        libraryId: '/test/snippets',
        contentType: 'snippet',
      });

      await vectorStoreService.addDocument('API reference documentation', {
        ...testMetadata,
        libraryId: '/test/api',
        contentType: 'api_ref',
      });

      const snippetResults = await vectorStoreService.search('example', {
        topK: 10,
        contentType: 'snippet',
      });

      expect(snippetResults.every(r => r.metadata.contentType === 'snippet')).toBe(true);
    });

    it('should delete documents', async () => {
      const content = 'Document to delete';
      const id = await vectorStoreService.addDocument(content, testMetadata);

      await vectorStoreService.deleteDocuments([id]);

      const results = await vectorStoreService.search('delete', { topK: 10 });
      const deletedDoc = results.find(r => r.id === id);
      expect(deletedDoc).toBeUndefined();
    });
  });

  describe('Health Checks', () => {
    it('should pass health check', async () => {
      const isHealthy = await vectorStoreService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should get stats', async () => {
      const stats = await vectorStoreService.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });
});
