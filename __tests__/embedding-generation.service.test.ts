import { EmbeddingGenerationService } from '../src/services/embedding-generation.service';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { EmbeddingGenerationConfig } from '../src/types/embeddings.types';

describe('EmbeddingGenerationService', () => {
  let service: EmbeddingGenerationService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockConfig: EmbeddingGenerationConfig;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    } as any;

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        setex: jest.fn(),
        exec: jest.fn().mockResolvedValue([])
      }),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      hgetall: jest.fn(),
      hincrby: jest.fn(),
      hset: jest.fn(),
      expire: jest.fn()
    } as any;

    mockConfig = {
      openaiApiKey: 'test-key',
      defaultModel: 'text-embedding-3-small',
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 100,
      cacheTTL: 86400
    };

    service = new EmbeddingGenerationService(mockDb, mockRedis, mockConfig);
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
            contentType: 'text' as const,
            position: 0,
            totalChunks: 1,
            lastModified: new Date()
          }
        }]
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ content: 'This is a test chunk' }] }) as any;

      const mockOpenAI = {
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: new Array(1536).fill(0.1) }]
          })
        }
      } as any;

      service['openai'] = mockOpenAI;

      const results = await service.generateEmbeddings(request);

      expect(results).toHaveLength(1);
      expect(results[0]!.chunkId).toBe('test-chunk');
      expect(results[0]!.embedding).toHaveLength(1536);
      expect(results[0]!.model).toBe('text-embedding-3-small');
    });

    it('should return cached results when available', async () => {
      const request = {
        chunks: [{
          id: 'test-chunk',
          content: 'This is a test chunk',
          metadata: {
            url: 'test.com',
            title: 'Test',
            contentType: 'text' as const,
            position: 0,
            totalChunks: 1,
            lastModified: new Date()
          }
        }]
      };

      const cachedResult = {
        chunkId: 'test-chunk',
        embedding: new Array(1536).fill(0.2),
        model: 'text-embedding-3-small',
        tokens: 10,
        cost: 0.0002,
        processingTime: 100
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const results = await service.generateEmbeddings(request);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(cachedResult);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should handle rate limiting gracefully', async () => {
      const request = {
        chunks: [{
          id: 'test-chunk',
          content: 'Test content',
          metadata: {
            url: 'test.com',
            title: 'Test',
            contentType: 'text' as const,
            position: 0,
            totalChunks: 1,
            lastModified: new Date()
          }
        }]
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ content: 'Test content' }] }) as any;

      const mockOpenAI = {
        embeddings: {
          create: jest.fn()
            .mockRejectedValueOnce(new Error('rate limit exceeded'))
            .mockResolvedValueOnce({
              data: [{ embedding: new Array(1536).fill(0.1) }]
            })
        }
      } as any;

      service['openai'] = mockOpenAI;

      const results = await service.generateEmbeddings(request);

      expect(results).toHaveLength(1);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should truncate content that exceeds maximum length', async () => {
      const longContent = 'a'.repeat(10000);
      const request = {
        chunks: [{
          id: 'test-chunk',
          content: longContent,
          metadata: {
            url: 'test.com',
            title: 'Test',
            contentType: 'text' as const,
            position: 0,
            totalChunks: 1,
            lastModified: new Date()
          }
        }]
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ content: longContent }] }) as any;

      const mockOpenAI = {
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: new Array(1536).fill(0.1) }]
          })
        }
      } as any;

      service['openai'] = mockOpenAI;

      await service.generateEmbeddings(request);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.arrayContaining([expect.stringMatching(/^a{8190}$/)])
        })
      );
    });

    it('should filter out empty chunks', async () => {
      const request = {
        chunks: [
          {
            id: 'valid-chunk',
            content: 'Valid content',
            metadata: {
              url: 'test.com',
              title: 'Test',
              contentType: 'text' as const,
              position: 0,
              totalChunks: 2,
              lastModified: new Date()
            }
          },
          {
            id: 'empty-chunk',
            content: '   ',
            metadata: {
              url: 'test.com',
              title: 'Test',
              contentType: 'text' as const,
              position: 1,
              totalChunks: 2,
              lastModified: new Date()
            }
          }
        ]
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ content: 'Valid content' }] }) as any;

      const mockOpenAI = {
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: new Array(1536).fill(0.1) }]
          })
        }
      } as any;

      service['openai'] = mockOpenAI;

      const results = await service.generateEmbeddings(request);

      expect(results).toHaveLength(1);
      expect(results[0]!.chunkId).toBe('valid-chunk');
    });
  });

  describe('getEmbeddingStats', () => {
    it('should return stats for a given time range', async () => {
      const mockStats = [
        {
          model: 'text-embedding-3-small',
          chunksProcessed: 10,
          totalTokens: 100,
          totalCost: 0.002,
          averageProcessingTime: 150,
          timestamp: new Date().toISOString()
        }
      ];

      mockRedis.lrange.mockResolvedValue(mockStats.map(s => JSON.stringify(s)));
      mockRedis.hgetall.mockResolvedValue({ hitRate: '0.8', errorRate: '0.1' });

      const stats = await service.getEmbeddingStats('day');

      expect(stats.totalChunks).toBe(10);
      expect(stats.totalTokens).toBe(100);
      expect(stats.totalCost).toBe(0.002);
      expect(stats.cacheHitRate).toBe(0.8);
      expect(stats.errorRate).toBe(0.1);
    });

    it('should return empty stats when no data available', async () => {
      mockRedis.lrange.mockResolvedValue([]);

      const stats = await service.getEmbeddingStats('day');

      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.errorRate).toBe(0);
    });
  });

  describe('private methods', () => {
    it('should count tokens correctly', () => {
      const text = 'This is a test text with 32 characters'; // 38 chars
      const service = new EmbeddingGenerationService(mockDb, mockRedis, mockConfig);
      const tokens = (service as any).countTokens(text);
      expect(tokens).toBe(Math.ceil(38 / 4)); // 10
    });

    it('should calculate cost correctly', () => {
      const service = new EmbeddingGenerationService(mockDb, mockRedis, mockConfig);
      const cost = (service as any).calculateCost(1000, 'text-embedding-3-small');
      expect(cost).toBe(0.00002);
    });

    it('should generate cache key correctly via CACHE_KEYS config', () => {
      const { CACHE_KEYS } = require('../src/config/embeddings.config');
      const content = 'test content';
      const model = 'text-embedding-3-small';
      const cacheKey = CACHE_KEYS.embedding(content, model);
      expect(cacheKey).toMatch(/^embedding:text-embedding-3-small:[a-f0-9]{64}$/);
    });
  });
});
