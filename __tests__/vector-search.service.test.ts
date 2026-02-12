import { VectorSearchService } from '../src/services/vector-search.service';
import { EmbeddingGenerationService } from '../src/services/embedding-generation.service';
import { Pool } from 'pg';
import { VectorSearchQuery } from '../src/types/embeddings.types';

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let mockDb: jest.Mocked<Pool>;
  let mockEmbeddingService: jest.Mocked<EmbeddingGenerationService>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    } as any;

    mockEmbeddingService = {
      generateEmbeddings: jest.fn()
    } as any;

    service = new VectorSearchService(mockDb, mockEmbeddingService);
  });

  describe('search', () => {
    it('should perform vector search successfully', async () => {
      const query: VectorSearchQuery = {
        query: 'test query',
        limit: 10,
        threshold: 0.7
      };

      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults = [
        {
          id: 'chunk1',
          library_id: 'lib1',
          content: 'Test content 1',
          embedding: mockEmbedding,
          embedding_model: 'text-embedding-3-small',
          embedding_version: 'v1',
          position: 0,
          total_chunks: 1,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.9,
          title: 'Test Title 1',
          url: 'test1.com',
          section: 'Section 1',
          subsection: 'Subsection 1',
          content_type: 'text',
          code_language: null,
          version: '1.0',
          file_path: '/path/to/file1',
          last_modified: new Date()
        }
      ];

      mockEmbeddingService.generateEmbeddings.mockResolvedValue([{
        chunkId: 'query',
        embedding: mockEmbedding,
        model: 'text-embedding-3-small',
        tokens: 5,
        cost: 0.0001,
        processingTime: 100
      }]);

      mockDb.query.mockResolvedValue({ rows: mockResults });

      const results = await service.search(query);

      expect(results).toHaveLength(1);
      expect(results[0]!.score).toBe(0.9);
      expect(results[0]!.relevance).toBe('high');
      expect(results[0]!.chunk.content).toBe('Test content 1');
    });

    it('should handle search with filters', async () => {
      const query: VectorSearchQuery = {
        query: 'test query',
        libraryId: 'lib1',
        filters: {
          contentType: ['text'],
          codeLanguage: ['javascript'],
          version: '1.0',
          section: ['Section 1']
        },
        limit: 5,
        threshold: 0.8
      };

      const mockEmbedding = new Array(1536).fill(0.1);
      mockEmbeddingService.generateEmbeddings.mockResolvedValue([{
        chunkId: 'query',
        embedding: mockEmbedding,
        model: 'text-embedding-3-small',
        tokens: 5,
        cost: 0.0001,
        processingTime: 100
      }]);

      mockDb.query.mockResolvedValue({ rows: [] });

      await service.search(query);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND dc.library_id = $4'),
        expect.arrayContaining([mockEmbedding, 5, 0.8, 'lib1', ['text'], ['javascript'], '1.0', ['Section 1']])
      );
    });

    it('should include metadata when requested', async () => {
      const query: VectorSearchQuery = {
        query: 'test query with words',
        limit: 10,
        includeMetadata: true
      };

      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults = [
        {
          id: 'chunk1',
          library_id: 'lib1',
          content: 'This content contains test words from the query',
          embedding: mockEmbedding,
          embedding_model: 'text-embedding-3-small',
          embedding_version: 'v1',
          position: 0,
          total_chunks: 1,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.85,
          title: 'Test Title',
          url: 'test.com',
          section: 'Section',
          subsection: 'Subsection',
          content_type: 'text',
          code_language: null,
          version: '1.0',
          file_path: '/path/to/file',
          last_modified: new Date()
        }
      ];

      mockEmbeddingService.generateEmbeddings.mockResolvedValue([{
        chunkId: 'query',
        embedding: mockEmbedding,
        model: 'text-embedding-3-small',
        tokens: 6,
        cost: 0.00012,
        processingTime: 120
      }]);

      mockDb.query.mockResolvedValue({ rows: mockResults });

      const results = await service.search(query);

      expect(results[0]!.highlights).toBeDefined();
      expect(results[0]!.highlights!.length).toBeGreaterThan(0);
      expect(results[0]!.highlights![0]).toContain('test');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when service is working', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ count: 100 }] }) as any;

      const health = await service.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.indexedChunks).toBe(100);
    });

    it('should return unhealthy status when there is an error', async () => {
      mockDb.query = jest.fn().mockRejectedValue(new Error('Database error')) as any;

      const health = await service.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBe('Database error');
    });
  });

  describe('getSimilarChunks', () => {
    it('should find similar chunks', async () => {
      const chunkId = 'test-chunk';
      const mockChunk = {
        content: 'Test content for similarity',
        embedding: new Array(1536).fill(0.2)
      };

      const mockQuery = mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockChunk] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      mockEmbeddingService.generateEmbeddings.mockResolvedValue([{
        chunkId: 'query',
        embedding: new Array(1536).fill(0.2),
        model: 'text-embedding-3-small',
        tokens: 5,
        cost: 0.0001,
        processingTime: 100
      }]);

      await service.getSimilarChunks(chunkId, 5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT content, embedding'),
        [chunkId]
      );
    });

    it('should throw error when chunk not found', async () => {
      const chunkId = 'non-existent-chunk';
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(service.getSimilarChunks(chunkId)).rejects.toThrow('Chunk with id non-existent-chunk not found');
    });
  });

  describe('updateChunkEmbedding', () => {
    it('should update chunk embedding', async () => {
      const chunkId = 'test-chunk';
      const embedding = new Array(1536).fill(0.3);

      const mockQuery2 = mockDb.query = jest.fn().mockResolvedValue({ rows: [] }) as any;

      await service.updateChunkEmbedding(chunkId, embedding);
      expect(mockQuery2).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE document_chunks'),
        [embedding, chunkId]
      );
    });
  });

  describe('deleteChunkEmbedding', () => {
    it('should delete chunk embedding', async () => {
      const chunkId = 'test-chunk';

      const mockQuery3 = mockDb.query = jest.fn().mockResolvedValue({ rows: [] }) as any;

      await service.deleteChunkEmbedding(chunkId);
      expect(mockQuery3).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE document_chunks'),
        [chunkId]
      );
    });
  });

  describe('getLibraryStats', () => {
    it('should return library statistics', async () => {
      const libraryId = 'test-library';
      const mockStats = {
        total_chunks: 100,
        indexed_chunks: 80,
        last_indexed: new Date()
      };

      mockDb.query = jest.fn().mockResolvedValue({ rows: [mockStats] }) as any;

      const stats = await service.getLibraryStats(libraryId);

      expect(stats.totalChunks).toBe(100);
      expect(stats.indexedChunks).toBe(80);
      expect(stats.totalChunks > 0 ? (stats.indexedChunks / stats.totalChunks) * 100 : 0).toBe(80);
      expect(stats.lastIndexed).toEqual(mockStats.last_indexed);
    });
  });

  describe('private methods', () => {
    it('should calculate relevance correctly', () => {
      const service = new VectorSearchService(mockDb, mockEmbeddingService);
      
      expect((service as any).calculateRelevance(0.9)).toBe('high');
      expect((service as any).calculateRelevance(0.8)).toBe('medium');
      expect((service as any).calculateRelevance(0.7)).toBe('low');
      expect((service as any).calculateRelevance(0.5)).toBe('low');
    });

    it('should generate highlights correctly', () => {
      const service = new VectorSearchService(mockDb, mockEmbeddingService);
      const content = 'This is a test sentence with multiple words. Another sentence follows.';
      const query = 'test words';
      
      const highlights = (service as any).generateHighlights(content, query);
      
      expect(highlights).toBeDefined();
      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights[0]).toContain('test');
    });
  });
});
