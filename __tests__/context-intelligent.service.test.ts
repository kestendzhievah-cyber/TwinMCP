// @ts-nocheck
import { ContextIntelligentService } from '../src/services/context-intelligent.service';
import { ContextQuery, ContextResult, ContextOptions, ContextFilters } from '../src/types/context-intelligent.types';
import { VectorSearchService } from '../src/services/vector-search.service';
import { NLPService } from '../src/services/nlp.service';
import { ContextTemplateEngine } from '../src/services/context-template.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock des services
jest.mock('../src/services/vector-search.service');
jest.mock('../src/services/nlp.service');
jest.mock('../src/services/context-template.service');

describe('ContextIntelligentService', () => {
  let service: ContextIntelligentService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockVectorSearch: jest.Mocked<VectorSearchService>;
  let mockNLPService: jest.Mocked<NLPService>;
  let mockTemplateEngine: jest.Mocked<ContextTemplateEngine>;

  beforeEach(() => {
    // Configuration des mocks
    mockDb = {
      query: jest.fn(),
    } as any;

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    } as any;

    mockVectorSearch = {
      search: jest.fn(),
    } as any;

    mockNLPService = {
      analyzeIntent: jest.fn(),
      extractEntities: jest.fn(),
      generateSummary: jest.fn(),
    } as any;

    mockTemplateEngine = {
      getTemplate: jest.fn(),
      render: jest.fn(),
    } as any;

    service = new ContextIntelligentService(
      mockDb,
      mockRedis,
      mockVectorSearch,
      mockNLPService,
      mockTemplateEngine
    );
  });

  describe('processQuery', () => {
    it('should process context query and return results', async () => {
      // Configuration du mock de cache (miss)
      mockRedis.get.mockResolvedValue(null);

      // Configuration des mocks NLP
      mockNLPService.analyzeIntent.mockResolvedValue({
        type: 'question',
        confidence: 0.9,
        keywords: ['react', 'hooks'],
        category: 'frontend',
        subcategory: 'react'
      });

      mockNLPService.extractEntities.mockResolvedValue([
        {
          text: 'react',
          type: 'library',
          confidence: 0.95,
          position: { start: 0, end: 5 }
        }
      ]);

      mockNLPService.generateSummary.mockResolvedValue('Summary of React hooks documentation');

      // Configuration du mock de recherche vectorielle
      mockVectorSearch.search.mockResolvedValue([
        {
          chunk: {
            id: 'chunk1',
            libraryId: 'react-docs',
            content: 'React hooks are functions that let you use state...',
            metadata: {
              title: 'Hooks Overview',
              contentType: 'documentation',
              section: 'hooks',
              position: 0,
              totalChunks: 10,
              lastModified: new Date()
            },
            embedding: [0.1, 0.2, 0.3],
            embeddingModel: 'text-embedding-ada-002',
            embeddingVersion: '1.0',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          score: 0.95,
          relevance: 'high'
        }
      ]);

      // Configuration du mock de template
      mockTemplateEngine.getTemplate.mockResolvedValue({
        id: 'template1',
        name: 'General Context',
        type: 'general_context',
        template: 'Context: {{summary}}',
        variables: ['summary'],
        metadata: {
          description: 'General context template',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        }
      });

      const query: ContextQuery = {
        id: 'test-query',
        conversationId: 'conv123',
        messageId: 'msg123',
        query: 'How to use React hooks?',
        intent: {} as any,
        entities: [],
        filters: {
          languages: ['javascript'],
          types: ['documentation', 'example'],
          minRelevance: 0.7,
          maxResults: 20
        },
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true,
          maxResults: 20
        },
        timestamp: new Date()
      };

      const result = await service.processQuery(query);

      expect(result).toBeDefined();
      expect(result.queryId).toBe(query.id);
      expect(result.sources).toBeDefined();
      expect(result.chunks).toBeDefined();
      expect(result.summary).toBe('Summary of React hooks documentation');
      expect(result.suggestions).toBeDefined();
      expect(result.metadata.totalSources).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalChunks).toBeGreaterThanOrEqual(0);
      expect(result.metadata.queryTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata.coverage).toBeGreaterThanOrEqual(0);
      expect(result.metadata.freshness).toBeGreaterThanOrEqual(0);

      // Vérification que le cache a été utilisé
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const cachedResult: ContextResult = {
        queryId: 'test-query',
        sources: [],
        chunks: [],
        summary: 'Cached summary',
        metadata: {
          totalSources: 0,
          totalChunks: 0,
          queryTime: 50,
          relevanceScore: 0.8,
          coverage: 0.7,
          freshness: 0.9
        },
        suggestions: []
      };

      const cacheData = {
        key: 'cache-key',
        query: 'test',
        result: cachedResult,
        expiresAt: new Date(Date.now() + 3600000),
        hitCount: 1,
        lastAccessed: new Date()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cacheData));

      const query: ContextQuery = {
        id: 'test-query',
        conversationId: 'conv123',
        messageId: 'msg123',
        query: 'Test query',
        intent: {} as any,
        entities: [],
        filters: {},
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true
        },
        timestamp: new Date()
      };

      const result = await service.processQuery(query);

      expect(result).toEqual(cachedResult);
      expect(mockRedis.get).toHaveBeenCalled();
      // setex is called by updateCacheAccess to refresh hit count
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockNLPService.analyzeIntent.mockRejectedValue(new Error('NLP Service Error'));

      const query: ContextQuery = {
        id: 'test-query',
        conversationId: 'conv123',
        messageId: 'msg123',
        query: 'Test query',
        intent: {} as any,
        entities: [],
        filters: {},
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true
        },
        timestamp: new Date()
      };

      await expect(service.processQuery(query)).rejects.toThrow('Context query failed: NLP Service Error');
    });
  });

  describe('injectContext', () => {
    it('should inject context into user message', async () => {
      const context: ContextResult = {
        queryId: 'test-query',
        sources: [
          {
            id: 'source1',
            type: 'documentation',
            title: 'React Hooks Documentation',
            content: 'React hooks are functions...',
            metadata: {
              language: 'javascript',
              tags: ['react', 'hooks'],
              relevanceScore: 0.9,
              freshness: 0.8,
              popularity: 0.7,
              lastUpdated: new Date()
            },
            chunks: []
          }
        ],
        chunks: [],
        summary: 'React hooks are functions that let you use state and other React features...',
        metadata: {
          totalSources: 1,
          totalChunks: 0,
          queryTime: 100,
          relevanceScore: 0.85,
          coverage: 0.9,
          freshness: 0.8
        },
        suggestions: []
      };

      const template = {
        id: 'template1',
        name: 'Code Context',
        type: 'code_context',
        template: 'Context: {{summary}}\n\nUser: {{userMessage}}',
        variables: ['summary', 'userMessage'],
        metadata: {
          description: 'Code context template',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        }
      };

      mockTemplateEngine.getTemplate.mockResolvedValue(template);
      mockTemplateEngine.render.mockResolvedValue(
        'Context: React hooks are functions that let you use state...\n\nUser: How do I use useState?'
      );

      mockDb.query.mockResolvedValue({ rows: [] });

      const injection = await service.injectContext(
        'conv123',
        'msg123',
        'How do I use useState?',
        context
      );

      expect(injection).toBeDefined();
      expect(injection.conversationId).toBe('conv123');
      expect(injection.messageId).toBe('msg123');
      expect(injection.context).toBe(context);
      expect(injection.template).toBe(template.id);
      expect(injection.injectedPrompt).toContain('React hooks are functions');
      expect(injection.metadata.originalLength).toBe(22); // "How do I use useState?"
      expect(injection.metadata.injectedLength).toBeGreaterThan(19);
      expect(injection.metadata.compressionRatio).toBeLessThan(1);
      expect(injection.metadata.relevanceScore).toBe(0.85);

      expect(mockTemplateEngine.getTemplate).toHaveBeenCalled();
      expect(mockTemplateEngine.render).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should calculate average relevance score correctly', () => {
      const results = {
        sources: [
          { id: 'source1', metadata: { relevanceScore: 0.9 } },
          { id: 'source2', metadata: { relevanceScore: 0.7 } },
          { id: 'source3', metadata: { relevanceScore: 0.8 } }
        ],
        chunks: [
          { sourceId: 'source1' },
          { sourceId: 'source2' },
          { sourceId: 'source3' }
        ]
      };

      // Accès à la méthode privée via reflection
      const score = (service as any).calculateRelevanceScore(results);
      expect(score).toBeCloseTo(0.8); // (0.9 + 0.7 + 0.8) / 3
    });

    it('should return 0 for empty results', () => {
      const results = { sources: [], chunks: [] };
      const score = (service as any).calculateRelevanceScore(results);
      expect(score).toBe(0);
    });
  });

  describe('calculateCoverage', () => {
    it('should calculate semantic coverage correctly', () => {
      const query: ContextQuery = {
        id: 'test',
        conversationId: 'conv',
        messageId: 'msg',
        query: 'react hooks tutorial',
        intent: {} as any,
        entities: [],
        filters: {},
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true
        },
        timestamp: new Date()
      };

      const results = {
        sources: [
          { id: 'source1', metadata: { relevanceScore: 0.9 } },
          { id: 'source2', metadata: { relevanceScore: 0.7 } }
        ],
        chunks: [
          { sourceId: 'source1', content: 'This is a React hooks tutorial...' },
          { sourceId: 'source2', content: 'Learn how to use React hooks effectively...' }
        ]
      };

      const coverage = (service as any).calculateCoverage(results, query);
      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThanOrEqual(1);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache key for same query', () => {
      const query: ContextQuery = {
        id: 'test',
        conversationId: 'conv',
        messageId: 'msg',
        query: 'react hooks',
        intent: {} as any,
        entities: [],
        filters: { languages: ['javascript'] },
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true
        },
        timestamp: new Date()
      };

      const key1 = (service as any).generateCacheKey(query);
      const key2 = (service as any).generateCacheKey(query);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^context_cache:[a-f0-9]{32}$/);
    });

    it('should generate different keys for different queries', () => {
      const query1: ContextQuery = {
        id: 'test1',
        conversationId: 'conv',
        messageId: 'msg',
        query: 'react hooks',
        intent: {} as any,
        entities: [],
        filters: {},
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true
        },
        timestamp: new Date()
      };

      const query2: ContextQuery = {
        ...query1,
        query: 'vue components'
      };

      const key1 = (service as any).generateCacheKey(query1);
      const key2 = (service as any).generateCacheKey(query2);

      expect(key1).not.toBe(key2);
    });
  });
});
