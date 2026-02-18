// @ts-nocheck
import { VectorStorageService } from '../src/services/vector-storage.service';
import { Pool } from 'pg';
import { VectorSearchQuery } from '../src/types/embeddings.types';

describe('VectorStorageService', () => {
  let service: VectorStorageService;
  let testDb: Pool;

  beforeEach(async () => {
    testDb = new Pool({ 
      connectionString: process.env['TEST_DATABASE_URL'] || 'postgresql://test:test@localhost:5432/test' 
    });
    service = new VectorStorageService(testDb);
    
    // Setup test schema
    await setupTestSchema(testDb);
  });

  afterEach(async () => {
    await cleanupTestSchema(testDb);
    await testDb.end();
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
          content: 'Content 1', // Same content
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
      // Insert test data
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
      const query: VectorSearchQuery = {
        query: 'React JavaScript',
        limit: 10,
        threshold: 0.7
      } as any;

      const results = await service.vectorSearch(query);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.score).toBeGreaterThan(0.7);
    });

    it('should apply filters correctly', async () => {
      const query: VectorSearchQuery = {
        query: 'React',
        libraryId: 'test-lib',
        filters: {
          contentType: ['text']
        },
        limit: 10,
        threshold: 0.7
      } as any;

      const results = await service.vectorSearch(query);
      
      expect(results).toHaveLength.greaterThan(0);
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
    beforeEach(async () => {
      // Insert old embedding
      await testDb.query(`
        INSERT INTO document_embeddings 
        (id, library_id, chunk_id, content, embedding, created_at, last_accessed_at)
        VALUES 
        ($1, $2, $3, $4, $5::vector, NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days')
      `, [
        'old-id',
        'test-lib',
        'old-chunk',
        'Old content',
        `[${new Array(1536).fill(0.1).join(',')}]`
      ]);
    });

    it('should cleanup old embeddings', async () => {
      const result = await service.cleanupOldEmbeddings(90);
      
      expect(result.deletedCount).toBe(1);
      expect(result.freedSpace).toBeDefined();
    });
  });
});

async function setupTestSchema(db: Pool) {
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    
    CREATE TYPE content_type AS ENUM ('text', 'code', 'example', 'api', 'tutorial', 'reference');
    CREATE TYPE embedding_model AS ENUM ('text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002');
    CREATE TYPE chunk_status AS ENUM ('pending', 'processing', 'indexed', 'error');
    
    CREATE TABLE IF NOT EXISTS document_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        library_id UUID NOT NULL,
        chunk_id TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        embedding vector(1536) NOT NULL,
        embedding_model embedding_model NOT NULL DEFAULT 'text-embedding-3-small',
        embedding_version VARCHAR(20) NOT NULL DEFAULT 'v1',
        metadata JSONB NOT NULL DEFAULT '{}',
        source_url TEXT,
        source_title TEXT,
        source_section TEXT,
        source_subsection TEXT,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        chunk_index INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        parent_chunk_id UUID REFERENCES document_embeddings(id),
        status chunk_status DEFAULT 'pending',
        error_message TEXT,
        processing_attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        indexed_at TIMESTAMP WITH TIME ZONE,
        last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_library_chunk UNIQUE (library_id, chunk_id)
    );
    
    CREATE INDEX idx_document_embeddings_embedding_ivfflat 
    ON document_embeddings 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
  `);
}

async function cleanupTestSchema(db: Pool) {
  await db.query('DROP TABLE IF EXISTS document_embeddings CASCADE');
  await db.query('DROP TYPE IF EXISTS content_type CASCADE');
  await db.query('DROP TYPE IF EXISTS embedding_model CASCADE');
  await db.query('DROP TYPE IF EXISTS chunk_status CASCADE');
}
