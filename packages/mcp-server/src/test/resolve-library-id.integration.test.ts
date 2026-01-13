import { ResolveLibraryHandler } from '../handlers/resolve-library.handler';
import { Pool } from 'pg';
import { createClient } from 'redis';

// Mock implementations for testing
class MockPool {
  async query(_sql: string, _params?: any[]): Promise<any> {
    return {
      rows: [
        {
          id: 'test-lib-1',
          name: 'react',
          display_name: 'React',
          description: 'A JavaScript library for building user interfaces',
          language: 'javascript',
          ecosystem: 'npm',
          popularity_score: 0.95,
          latest_version: '18.2.0',
          homepage: 'https://reactjs.org',
          repository: 'https://github.com/facebook/react',
          tags: ['ui', 'frontend', 'javascript'],
          created_at: new Date(),
          updated_at: new Date()
        }
      ]
    };
  }
}

class MockRedis {
  private cache = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.cache.get(key) || null;
  }

  async setEx(key: string, ttl: number, value: string): Promise<void> {
    this.cache.set(key, value);
  }
}

describe('Resolve Library ID Integration', () => {
  let handler: ResolveLibraryHandler;
  let mockDB: MockPool;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockDB = new MockPool();
    mockRedis = new MockRedis();
    handler = new ResolveLibraryHandler(mockDB as any, mockRedis as any);
  });

  test('should resolve React library correctly', async () => {
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
    
    expect(result.query).toBe('react');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('react');
    expect(result.results[0].language).toBe('javascript');
    expect(result.results[0].ecosystem).toBe('npm');
    expect(result.results[0].relevance_score).toBeGreaterThan(0.8);
    expect(result.total_found).toBe(1);
    expect(result.processing_time_ms).toBeGreaterThan(0);
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
        query: 'express',
        context: expect.objectContaining({
          language: 'javascript',
          ecosystem: 'npm',
          framework: 'node'
        })
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
    
    expect(result.results.length).toBeGreaterThanOrEqual(0);
    expect(result.processing_time_ms).toBeGreaterThan(0);
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
    
    expect(result.results.length).toBeLessThanOrEqual(2);
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
    
    expect(result.results[0].aliases).toBeDefined();
    expect(Array.isArray(result.results[0].aliases)).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    // Mock database error
    const mockErrorDB = {
      query: jest.fn().mockRejectedValue(new Error('Database connection failed'))
    };
    
    const errorHandler = new ResolveLibraryHandler(mockErrorDB as any, mockRedis as any);
    
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

    await expect(errorHandler.handler(input, mockContext)).rejects.toThrow('Library resolution failed');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
