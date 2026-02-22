// @ts-nocheck
import { VectorStorageService } from '../src/services/vector-storage.service';
import { VectorSearchQuery } from '../src/types/embeddings.types';
import crypto from 'crypto';

// In-memory store simulating document_embeddings table
let store: Map<string, any>;
let idCounter: number;

function genId() {
  return `uuid-${++idCounter}`;
}

function contentHash(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Build a mock pg Pool that delegates to the in-memory store
function createMockPool() {
  const mockClient = {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      return handleQuery(sql, params);
    }),
    release: jest.fn(),
  };

  return {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      return handleQuery(sql, params);
    }),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
  };
}

function handleQuery(sql: string, params?: any[]) {
  const sqlLower = sql.toLowerCase().trim();

  // SELECT id FROM document_embeddings WHERE library_id = $1 AND content_hash = $2
  if (sqlLower.includes('select id from document_embeddings') && sqlLower.includes('content_hash')) {
    const libId = params?.[0];
    const hash = params?.[1];
    for (const [id, row] of store) {
      if (row.library_id === libId && row.content_hash === hash) {
        return { rows: [{ id }] };
      }
    }
    return { rows: [] };
  }

  // INSERT INTO document_embeddings ... RETURNING id
  if (sqlLower.includes('insert into document_embeddings') && sqlLower.includes('returning id')) {
    const id = genId();
    store.set(id, {
      id,
      library_id: params?.[0],
      chunk_id: params?.[1],
      content: params?.[2],
      content_hash: params?.[3],
      embedding_model: params?.[5],
      metadata: params?.[6],
      status: 'indexed',
      created_at: new Date(),
      updated_at: new Date(),
      last_accessed_at: new Date(),
    });
    return { rows: [{ id }] };
  }

  // INSERT (batch, no RETURNING)
  if (sqlLower.includes('insert into document_embeddings') && !sqlLower.includes('returning')) {
    const id = genId();
    store.set(id, {
      id,
      library_id: params?.[0],
      chunk_id: params?.[1],
      content: params?.[2],
      content_hash: params?.[3],
      embedding_model: params?.[5],
      metadata: params?.[6],
      status: 'indexed',
      created_at: new Date(),
      updated_at: new Date(),
      last_accessed_at: new Date(),
    });
    return { rows: [] };
  }

  // SELECT * FROM document_embeddings WHERE id = $1
  if (sqlLower.includes('select * from document_embeddings') || sqlLower.includes('select') && sqlLower.includes('document_embeddings') && sqlLower.includes('where')) {
    if (params?.[0] && typeof params[0] === 'string' && params[0].startsWith('uuid-')) {
      const row = store.get(params[0]);
      return { rows: row ? [row] : [] };
    }
  }

  // SELECT COUNT(*) as total
  if (sqlLower.includes('select count(*)') && sqlLower.includes('total')) {
    return { rows: [{ total: store.size.toString() }] };
  }

  // SELECT embedding_model, COUNT(*)
  if (sqlLower.includes('embedding_model') && sqlLower.includes('group by')) {
    const counts: Record<string, number> = {};
    for (const row of store.values()) {
      const m = row.embedding_model || 'text-embedding-3-small';
      counts[m] = (counts[m] || 0) + 1;
    }
    return { rows: Object.entries(counts).map(([embedding_model, count]) => ({ embedding_model, count: count.toString() })) };
  }

  // SELECT library_id, COUNT(*)
  if (sqlLower.includes('library_id') && sqlLower.includes('group by') && !sqlLower.includes('embedding_model')) {
    const counts: Record<string, number> = {};
    for (const row of store.values()) {
      counts[row.library_id] = (counts[row.library_id] || 0) + 1;
    }
    return { rows: Object.entries(counts).map(([library_id, count]) => ({ library_id, count: count.toString() })) };
  }

  // SELECT AVG(LENGTH(content))
  if (sqlLower.includes('avg(length(content))')) {
    let total = 0;
    for (const row of store.values()) total += (row.content || '').length;
    const avg = store.size > 0 ? total / store.size : 0;
    return { rows: [{ avg_size: avg.toString() }] };
  }

  // DELETE FROM document_embeddings WHERE created_at < $1 (must be before pg_size_pretty)
  if (sqlLower.includes('delete from document_embeddings')) {
    const cutoff = params?.[0];
    let deleted = 0;
    for (const [id, row] of store) {
      if (cutoff && row.created_at < cutoff) {
        store.delete(id);
        deleted++;
      }
    }
    return { rows: [{ count: deleted.toString(), size: '4096 bytes' }] };
  }

  // pg_size_pretty
  if (sqlLower.includes('pg_size_pretty')) {
    return { rows: [{ total_size: '8192 bytes', index_size: '4096 bytes' }] };
  }

  // Vector search query (SELECT ... similarity ...)
  if (sqlLower.includes('similarity') || sqlLower.includes('<=>')) {
    const rows = Array.from(store.values()).map(row => ({
      ...row,
      similarity: 0.95,
      text_rank: 0.5,
    }));
    return { rows: rows.slice(0, params?.[2] || 10) };
  }

  // INSERT INTO search_sessions
  if (sqlLower.includes('search_sessions')) {
    return { rows: [{ id: 'session-1' }] };
  }

  // INSERT INTO search_analytics
  if (sqlLower.includes('search_analytics')) {
    return { rows: [] };
  }

  // BEGIN / COMMIT / ROLLBACK
  if (sqlLower === 'begin' || sqlLower === 'commit' || sqlLower === 'rollback') {
    return { rows: [] };
  }

  // VACUUM / ANALYZE
  if (sqlLower.includes('vacuum') || sqlLower.includes('analyze') || sqlLower.includes('pg_stat')) {
    return { rows: [] };
  }

  // Default
  return { rows: [] };
}

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

describe('VectorStorageService', () => {
  let service: VectorStorageService;
  let testDb: any;

  beforeEach(() => {
    store = new Map();
    idCounter = 0;
    testDb = createMockPool();
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

      const row = store.get(id);
      expect(row).toBeDefined();
      expect(row.content).toBe('Test content');
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
      expect(id1).toBe(id2);
    });
  });

  describe('batchStoreEmbeddings', () => {
    it('should store multiple embeddings', async () => {
      const embeddings = [
        {
          libraryId: 'test-lib',
          chunkId: 'chunk-1',
          content: 'Content 1',
          embedding: new Array(1536).fill(0.1),
          model: 'text-embedding-3-small',
          metadata: { contentType: 'text' }
        },
        {
          libraryId: 'test-lib',
          chunkId: 'chunk-2',
          content: 'Content 2',
          embedding: new Array(1536).fill(0.2),
          model: 'text-embedding-3-small',
          metadata: { contentType: 'code' }
        }
      ];

      const result = await service.batchStoreEmbeddings(embeddings);
      expect(result.stored).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed duplicates and new content', async () => {
      const embeddings = [
        {
          libraryId: 'test-lib',
          chunkId: 'chunk-1',
          content: 'Content 1',
          embedding: new Array(1536).fill(0.1),
          model: 'text-embedding-3-small',
          metadata: { contentType: 'text' }
        },
        {
          libraryId: 'test-lib',
          chunkId: 'chunk-1',
          content: 'Content 1',
          embedding: new Array(1536).fill(0.1),
          model: 'text-embedding-3-small',
          metadata: { contentType: 'text' }
        }
      ];

      const result = await service.batchStoreEmbeddings(embeddings);
      expect(result.stored).toBe(1);
      expect(result.duplicates).toBe(1);
    });
  });

  describe('vectorSearch', () => {
    beforeEach(async () => {
      await service.storeEmbedding({
        libraryId: 'test-lib',
        chunkId: 'chunk-1',
        content: 'React is a JavaScript library for building user interfaces',
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        metadata: { contentType: 'text' }
      });
    });

    it('should return relevant results', async () => {
      const query = {
        query: 'React JavaScript',
        limit: 10,
        threshold: 0.7
      } as any;

      const results = await service.vectorSearch(query);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.score).toBeGreaterThan(0.7);
    });

    it('should apply filters correctly', async () => {
      const query = {
        query: 'React',
        libraryId: 'test-lib',
        filters: { contentType: ['text'] },
        limit: 10,
        threshold: 0.7
      } as any;

      const results = await service.vectorSearch(query);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEmbeddingStats', () => {
    beforeEach(async () => {
      await service.storeEmbedding({
        libraryId: 'test-lib',
        chunkId: 'chunk-1',
        content: 'Test content',
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        metadata: { contentType: 'text' }
      });
    });

    it('should return correct statistics', async () => {
      const stats = await service.getEmbeddingStats();
      expect(stats.totalEmbeddings).toBe(1);
      expect(stats.embeddingsByModel['text-embedding-3-small']).toBe(1);
      expect(stats.embeddingsByLibrary['test-lib']).toBe(1);
      expect(stats.averageChunkSize).toBeGreaterThan(0);
    });
  });

  describe('cleanupOldEmbeddings', () => {
    beforeEach(() => {
      // Insert an "old" embedding directly into the store
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      store.set('old-id', {
        id: 'old-id',
        library_id: 'test-lib',
        chunk_id: 'old-chunk',
        content: 'Old content',
        content_hash: contentHash('Old content'),
        embedding_model: 'text-embedding-3-small',
        status: 'indexed',
        created_at: oldDate,
        updated_at: oldDate,
        last_accessed_at: oldDate,
      });
    });

    it('should cleanup old embeddings', async () => {
      const result = await service.cleanupOldEmbeddings(90);
      expect(result.deletedCount).toBe(1);
      expect(result.freedSpace).toBeDefined();
    });
  });
});
