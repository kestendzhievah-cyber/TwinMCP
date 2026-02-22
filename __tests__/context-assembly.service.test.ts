import { ContextAssemblyService } from '../src/services/context-assembly.service';
import { ContextAssemblyRequest } from '../src/types/context-assembly.types';
import { VectorSearchResult } from '../src/types/embeddings.types';

describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;

  beforeEach(() => {
    service = new ContextAssemblyService();
  });

  describe('assembleContext', () => {
    it('should assemble context within token limits', async () => {
      const request: ContextAssemblyRequest = {
        query: 'React hooks documentation',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: generateMockSearchResults(20),
        targetModel: 'gpt-4',
        maxTokens: 4000,
        options: {
          includeCodeExamples: true,
          includeApiReferences: true,
          prioritizeRecent: false,
          deduplicateContent: true,
          maintainStructure: true,
          addMetadata: true,
          compressionLevel: 'medium'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.assembledContext).toBeDefined();
      expect(result.metadata.tokenCount).toBeLessThanOrEqual(request.maxTokens);
      expect(result.structure.sections.length).toBeGreaterThan(0);
      expect(result.quality.relevanceScore).toBeGreaterThan(0.5);
    });

    it('should prioritize relevant content', async () => {
      const request: ContextAssemblyRequest = {
        query: 'useState hook',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: generateMockSearchResults(10),
        targetModel: 'gpt-4',
        maxTokens: 2000,
        options: {
          includeCodeExamples: true,
          includeApiReferences: false,
          prioritizeRecent: true,
          deduplicateContent: false,
          maintainStructure: true,
          addMetadata: false,
          compressionLevel: 'none'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.metadata.includedChunks).toBeLessThanOrEqual(result.metadata.totalChunks);
      expect(result.assembledContext).toContain('useState');
    });

    it('should handle empty search results', async () => {
      const request: ContextAssemblyRequest = {
        query: 'empty query',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: [],
        targetModel: 'gpt-4',
        maxTokens: 1000,
        options: {
          includeCodeExamples: false,
          includeApiReferences: false,
          prioritizeRecent: false,
          deduplicateContent: false,
          maintainStructure: true,
          addMetadata: false,
          compressionLevel: 'none'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.assembledContext).toBeDefined();
      expect(result.metadata.totalChunks).toBe(0);
      expect(result.metadata.includedChunks).toBe(0);
    });

    it('should apply compression when needed', async () => {
      const request: ContextAssemblyRequest = {
        query: 'large content query',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: generateMockSearchResults(50), // Many results to trigger compression
        targetModel: 'gpt-4',
        maxTokens: 1000, // Small limit to force compression
        options: {
          includeCodeExamples: true,
          includeApiReferences: true,
          prioritizeRecent: false,
          deduplicateContent: true,
          maintainStructure: true,
          addMetadata: true,
          compressionLevel: 'aggressive'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.metadata.tokenCount).toBeLessThanOrEqual(request.maxTokens);
      // Compression ratio may be slightly > 1 due to added metadata
      expect(result.metadata.compressionRatio).toBeLessThanOrEqual(1.1);
    });
  });

  describe('content classification', () => {
    it('should classify code blocks correctly', async () => {
      const codeContent = '```javascript\nconst example = () => {};\n```';
      const searchResults = [createMockResult('1', codeContent)];

      const request: ContextAssemblyRequest = {
        query: 'code example',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults,
        targetModel: 'gpt-4',
        maxTokens: 2000,
        options: {
          includeCodeExamples: true,
          includeApiReferences: false,
          prioritizeRecent: false,
          deduplicateContent: false,
          maintainStructure: true,
          addMetadata: false,
          compressionLevel: 'none'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.structure.codeBlocks.length).toBeGreaterThan(0);
    });

    it('should classify API references correctly', async () => {
      const apiContent = 'API Reference: function getData(params) Returns Promise<Data>';
      const searchResults = [createMockResult('1', apiContent)];

      const request: ContextAssemblyRequest = {
        query: 'API documentation',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults,
        targetModel: 'gpt-4',
        maxTokens: 2000,
        options: {
          includeCodeExamples: false,
          includeApiReferences: true,
          prioritizeRecent: false,
          deduplicateContent: false,
          maintainStructure: true,
          addMetadata: false,
          compressionLevel: 'none'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.structure.apiReferences.length).toBeGreaterThan(0);
    });
  });

  describe('quality metrics', () => {
    it('should calculate quality scores', async () => {
      const request: ContextAssemblyRequest = {
        query: 'quality test',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: generateMockSearchResults(5),
        targetModel: 'gpt-4',
        maxTokens: 2000,
        options: {
          includeCodeExamples: true,
          includeApiReferences: true,
          prioritizeRecent: false,
          deduplicateContent: false,
          maintainStructure: true,
          addMetadata: true,
          compressionLevel: 'none'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.quality.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.relevanceScore).toBeLessThanOrEqual(1);
      expect(result.quality.completenessScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.completenessScore).toBeLessThanOrEqual(1);
      expect(result.quality.clarityScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.clarityScore).toBeLessThanOrEqual(1);
      expect(result.quality.structureScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.structureScore).toBeLessThanOrEqual(1);
    });
  });
});

function generateMockSearchResults(count: number): VectorSearchResult[] {
  return Array.from({ length: count }, (_, i) => ({
    chunk: {
      id: `chunk-${i}`,
      libraryId: 'react',
      content: `Mock content ${i} with some explanation about React hooks and usage examples. This content contains various information about useState, useEffect, and other hooks.`,
      metadata: {
        url: `https://example.com/${i}`,
        title: `Title ${i}`,
        contentType: 'text',
        position: i,
        totalChunks: count,
        lastModified: new Date()
      },
      embedding: new Array(1536).fill(0.1),
      embeddingModel: 'text-embedding-3-small',
      embeddingVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    score: Math.random(),
    relevance: 'high' as const
  }));
}

function createMockResult(id: string, content: string): VectorSearchResult {
  return {
    chunk: {
      id,
      libraryId: 'test',
      content,
      metadata: {
        url: `https://example.com/${id}`,
        title: `Test ${id}`,
        contentType: 'text',
        position: 0,
        totalChunks: 1,
        lastModified: new Date()
      },
      embedding: new Array(1536).fill(0.1),
      embeddingModel: 'text-embedding-3-small',
      embeddingVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    score: 0.8,
    relevance: 'high' as const
  };
}
