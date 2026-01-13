import { TwinMCPServer } from '../server';
import { TwinMCPClient } from '../client/twinmcp-client';
import { MCPLogger } from '../utils/logger';
import { QueryDocsParams, QueryDocsResult } from '../types/mcp';

class MockTwinMCPClient extends TwinMCPClient {
  override async resolveLibrary(_params: any) {
    return {
      libraryId: '/test/library',
      name: 'Test Library',
      confidence: 0.95,
    };
  }

  override async queryDocs(params: QueryDocsParams): Promise<QueryDocsResult> {
    return {
      content: 'Test documentation content',
      snippets: [{
        id: 'chunk1',
        content: 'Test snippet',
        metadata: {
          libraryId: params.libraryId,
          version: params.version || '1.0.0',
          contentType: 'guide' as const,
          sourceUrl: 'https://example.com',
          tokenCount: 100,
        },
        score: 0.9,
      }],
      totalResults: 1,
      totalTokens: 100,
      libraryId: params.libraryId,
      version: params.version || '1.0.0',
      query: params.query,
    };
  }

  override async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('TwinMCP Server', () => {
  let server: TwinMCPServer;
  let mockClient: MockTwinMCPClient;

  beforeEach(() => {
    mockClient = new MockTwinMCPClient();
    server = new TwinMCPServer({
      logger: MCPLogger.create('Test'),
    });

    (server as any).client = mockClient;
  });

  describe('Tool Registration', () => {
    it('should register resolve-library-id tool', () => {
      const handlers = (server as any).handlers;
      expect(handlers.has('resolve-library-id')).toBe(true);
    });

    it('should register query-docs tool', () => {
      const handlers = (server as any).handlers;
      expect(handlers.has('query-docs')).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute resolve-library-id tool', async () => {
      const handler = (server as any).handlers.get('resolve-library-id');
      const context = {
        requestId: 'test-123',
        config: {},
        logger: MCPLogger.create('Test'),
      };

      const result = await handler.handler(
        { query: 'test library' },
        context
      );

      expect(result.libraryId).toBe('/test/library');
      expect(result.name).toBe('Test Library');
      expect(result.confidence).toBe(0.95);
    });

    it('should execute query-docs tool', async () => {
      const handler = (server as any).handlers.get('query-docs');
      const context = {
        requestId: 'test-456',
        config: {},
        logger: MCPLogger.create('Test'),
      };

      const result = await handler.handler(
        {
          libraryId: '/test/library',
          query: 'how to use',
        },
        context
      );

      expect(result.content).toBe('Test documentation content');
      expect(result.snippets).toHaveLength(1);
      expect(result.libraryId).toBe('/test/library');
    });
  });
});
