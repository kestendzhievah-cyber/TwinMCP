import { ResolveLibraryHandler } from '../handlers/resolve-library.handler';
import { TwinMCPClient } from '../client/twinmcp-client';
import { ResolveLibraryParams, ResolveLibraryResult } from '../types/mcp';

class MockTwinMCPClient extends TwinMCPClient {
  override async resolveLibrary(params: ResolveLibraryParams): Promise<ResolveLibraryResult> {
    return {
      libraryId: `/libraries/${params.query}`,
      name: params.query,
      confidence: 0.92,
      repoUrl: 'https://github.com/test/library',
      docsUrl: 'https://docs.example.com'
    };
  }
}

describe('Resolve Library ID Integration', () => {
  let handler: ResolveLibraryHandler;

  beforeEach(() => {
    handler = new ResolveLibraryHandler(new MockTwinMCPClient());
  });

  test('should resolve library correctly', async () => {
    const input = {
      query: 'react',
      limit: 5
    };
    
    const mockContext = {
      requestId: 'test-123',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    const result = await handler.handler(input, mockContext);
    
    expect(result.libraryId).toBe('/libraries/react');
    expect(result.name).toBe('react');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('should handle context parameters', async () => {
    const input = {
      query: 'express',
      context: {
        language: 'javascript',
        ecosystem: 'npm',
        framework: 'node'
      },
      limit: 3
    };
    
    const mockContext = {
      requestId: 'test-456',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    const result = await handler.handler(input, mockContext);
    
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Resolving library',
      expect.objectContaining({
        query: 'express'
      })
    );
  });

  test('should handle misspelled queries', async () => {
    const input = {
      query: 'reack', // Faute de frappe
      limit: 5
    };
    
    const mockContext = {
      requestId: 'test-789',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    const result = await handler.handler(input, mockContext);
    
    expect(result.libraryId).toBe('/libraries/reack');
  });

  test('should validate input parameters', async () => {
    const input = {
      query: '', // Empty query should fail validation
      limit: 5
    };
    
    const mockContext = {
      requestId: 'test-validation',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    await expect(handler.handler(input, mockContext)).rejects.toThrow();
  });

  test('should handle limit parameter correctly', async () => {
    const input = {
      query: 'react',
      limit: 2
    };
    
    const mockContext = {
      requestId: 'test-limit',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    const result = await handler.handler(input, mockContext);
    
    expect(result.libraryId).toBe('/libraries/react');
  });

  test('should include aliases when requested', async () => {
    const input = {
      query: 'react',
      include_aliases: true,
      limit: 5
    };
    
    const mockContext = {
      requestId: 'test-aliases',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    const result = await handler.handler(input, mockContext);
    
    expect(result.libraryId).toBe('/libraries/react');
  });

  test('should handle errors gracefully', async () => {
    class ErrorClient extends TwinMCPClient {
      override async resolveLibrary(): Promise<ResolveLibraryResult> {
        throw new Error('Backend unavailable');
      }
    }

    const errorHandler = new ResolveLibraryHandler(new ErrorClient());
    
    const input = {
      query: 'react',
      limit: 5
    };
    
    const mockContext = {
      requestId: 'test-error',
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    await expect(errorHandler.handler(input, mockContext)).rejects.toThrow('Backend unavailable');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
