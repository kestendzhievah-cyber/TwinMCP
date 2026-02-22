import { QueryDocsTool } from '../../lib/mcp/tools/query-docs.tool'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

describe('QueryDocsTool', () => {
  let tool: QueryDocsTool
  let mockDb: PrismaClient
  let mockRedis: Redis

  beforeEach(() => {
    // Mock database and Redis connections
    mockDb = new PrismaClient() as any
    mockRedis = new Redis() as any
    
    tool = new QueryDocsTool()
  })

  afterEach(async () => {
    // Cleanup
    await tool['cleanup']()
  })

  test('should validate input correctly', async () => {
    const input = {
      library_id: 'react',
      query: 'How to use hooks?',
      max_results: 5
    }
    
    const validation = await tool.validate(input)
    expect(validation.success).toBe(true)
    expect(validation.data).toEqual(expect.objectContaining({
      library_id: 'react',
      query: 'How to use hooks?',
      max_results: 5
    }))
  })

  test('should reject invalid input', async () => {
    const input = {
      library_id: '', // Invalid: empty string
      query: 'test'
    }
    
    const validation = await tool.validate(input)
    expect(validation.success).toBe(false)
    expect(validation.errors).toHaveLength(1)
    expect(validation.errors![0].path).toBe('library_id')
  })

  test('should handle missing library gracefully', async () => {
    const input = {
      library_id: 'nonexistent',
      query: 'test query'
    }
    
    // Mock the database to return null for library
    jest.spyOn(mockDb.library, 'findUnique').mockResolvedValue(null)
    
    const result = await tool.execute(input, {})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('failed')
  })

  test('should have correct tool metadata', () => {
    expect(tool.id).toBe('query-docs')
    expect(tool.name).toBe('query-docs')
    expect(tool.category).toBe('development')
    expect(tool.description).toBe('Search documentation for a specific library')
    expect(tool.tags).toContain('documentation')
    expect(tool.tags).toContain('search')
  })

  test('should have proper rate limiting configured', () => {
    expect(tool.rateLimit.requests).toBe(50)
    expect(tool.rateLimit.period).toBe('1m')
    expect(tool.rateLimit.strategy).toBe('sliding')
  })

  test('should have cache configuration', () => {
    expect(tool.cache.enabled).toBe(true)
    expect(tool.cache.ttl).toBe(600)
    expect(tool.cache.strategy).toBe('memory')
  })
})
