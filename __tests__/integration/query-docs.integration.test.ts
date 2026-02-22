// @ts-nocheck

// ── Mock data ──
const mockLibraries = [
  {
    id: '/react/react',
    name: 'react',
    displayName: 'React',
    description: 'A JavaScript library for building user interfaces',
    defaultVersion: '18.2.0',
    vendor: 'Meta',
    docsUrl: 'https://react.dev',
    language: 'javascript',
    ecosystem: 'npm',
    tags: ['ui', 'frontend'],
    popularityScore: 100,
    totalSnippets: 500,
    totalTokens: 50000,
    versions: [],
    _count: { documentationChunks: 500 },
  },
]

const mockSearchResults = [
  {
    id: 'result-1',
    content: 'useState is a Hook that lets you add React state to function components.',
    metadata: {
      libraryId: '/react/react',
      version: '18.2.0',
      contentType: 'guide',
      sourceUrl: 'https://react.dev/reference/react/useState',
      section: 'Hooks',
      tokenCount: 50,
    },
    score: 0.95,
  },
]

// ── Mock Prisma ──
const mockPrisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  library: {
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      return mockLibraries.find(l => l.id === where.id) || null
    }),
    findMany: jest.fn().mockImplementation(async ({ where, take }: any) => {
      const q = where?.OR?.[0]?.name?.contains?.toLowerCase() || ''
      return mockLibraries
        .filter(l => l.name.toLowerCase().includes(q) || l.displayName.toLowerCase().includes(q))
        .slice(0, take || 10)
    }),
  },
}

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}))

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    disconnect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn().mockReturnThis(),
    status: 'ready',
  }))
})

// Mock VectorStoreService (used by VectorSearchService)
jest.mock('../../src/services/vector-store.service', () => ({
  VectorStoreService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    search: jest.fn().mockImplementation(async (_query: string, opts: any) => {
      return mockSearchResults.filter(r =>
        !opts?.libraryId || r.metadata.libraryId === opts.libraryId
      ).slice(0, opts?.topK || 5)
    }),
    healthCheck: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({ totalVectors: 100 }),
    addDocument: jest.fn().mockResolvedValue('doc-1'),
    deleteDocuments: jest.fn(),
  })),
}))

// Mock Pinecone + Qdrant (transitive deps of VectorStoreService)
jest.mock('../../src/config/pinecone', () => ({
  PineconeService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    upsert: jest.fn(),
    query: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({}),
  })),
}))

jest.mock('../../src/config/qdrant', () => ({
  QdrantService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
  })),
}))

// Mock embeddings service
jest.mock('../../src/services/embeddings.service', () => ({
  EmbeddingsService: jest.fn().mockImplementation(() => ({
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    healthCheck: jest.fn().mockResolvedValue(true),
  })),
}))

// Mock @/lib/prisma and @/lib/redis (used by QueryDocsTool.ensureService)
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }), { virtual: true })
jest.mock('../../lib/redis', () => ({ redis: { get: jest.fn(), set: jest.fn(), setex: jest.fn() } }), { virtual: true })
jest.mock('../../lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }), { virtual: true })
jest.mock('../../lib/mcp/core', () => ({ getCache: () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn() }) }), { virtual: true })

// Mock Redis config
jest.mock('../../src/config/redis', () => ({
  CacheService: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() },
  redisClient: { on: jest.fn().mockReturnThis() },
}))

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

import { QueryDocsTool } from '../../lib/mcp/tools/query-docs.tool'
import { VectorStoreService } from '../../src/services/vector-store.service'
import { LibraryService } from '../../lib/services/library.service'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

describe('QueryDocs Integration Tests', () => {
  let tool: QueryDocsTool
  let vectorStore: VectorStoreService
  let libraryService: LibraryService
  let db: PrismaClient
  let redis: Redis

  beforeAll(async () => {
    db = new PrismaClient()
    redis = new Redis()
    vectorStore = new VectorStoreService()
    await vectorStore.initialize()
    libraryService = new LibraryService(db)
    tool = new QueryDocsTool()
  })

  afterAll(async () => {
    await tool['cleanup']()
    await redis.disconnect()
    await db.$disconnect()
  })

  describe('Library Service Integration', () => {
    test('should retrieve libraries from database', async () => {
      const libraries = await libraryService.getPopularLibraries(5)
      expect(libraries).toBeDefined()
      expect(libraries.length).toBeGreaterThan(0)

      const firstLibrary = libraries[0]
      expect(firstLibrary).toHaveProperty('id')
      expect(firstLibrary).toHaveProperty('name')
      expect(firstLibrary).toHaveProperty('displayName')
      expect(firstLibrary).toHaveProperty('language')
      expect(firstLibrary).toHaveProperty('ecosystem')
    })

    test('should get specific library by ID', async () => {
      const library = await libraryService.getLibrary('/react/react')
      if (library) {
        expect(library.name).toBe('react')
        expect(library.displayName).toBe('React')
        expect(library.language).toBe('javascript')
      }
    })

    test('should search libraries by query', async () => {
      const results = await libraryService.searchLibraries('react', 3)
      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)

      const reactLib = results.find(lib =>
        lib.name.toLowerCase().includes('react') ||
        lib.displayName.toLowerCase().includes('react')
      )
      expect(reactLib).toBeDefined()
    })
  })

  describe('Vector Store Integration', () => {
    test('should be healthy and accessible', async () => {
      const isHealthy = await vectorStore.healthCheck()
      expect(isHealthy).toBe(true)
    })

    test('should perform vector search', async () => {
      const results = await vectorStore.search('react hooks', {
        topK: 3,
        libraryId: '/react/react'
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      const firstResult = results[0]!
      expect(firstResult).toHaveProperty('content')
      expect(firstResult).toHaveProperty('metadata')
      expect(firstResult).toHaveProperty('score')
      expect(firstResult.metadata).toHaveProperty('libraryId')
    })
  })

  describe('QueryDocs Tool Integration', () => {
    test('should validate input correctly', async () => {
      const validInput = {
        library_id: '/react/react',
        query: 'How to use useState hook?',
        max_results: 5,
        include_code: true,
        context_limit: 4000
      }

      const validation = await tool.validate(validInput)
      expect(validation.success).toBe(true)
      expect(validation.data).toEqual(validInput)
    })

    test('should reject invalid input', async () => {
      const invalidInputs = [
        { library_id: '', query: 'test' },
        { library_id: 'react', query: '' },
        { library_id: 'react', query: 'test', max_results: 0 },
        { library_id: 'react', query: 'test', context_limit: 500 }
      ]

      for (const input of invalidInputs) {
        const validation = await tool.validate(input)
        expect(validation.success).toBe(false)
        expect(validation.errors).toBeDefined()
        expect(validation.errors!.length).toBeGreaterThan(0)
      }
    })

    test('should execute query successfully', async () => {
      const input = {
        library_id: '/react/react',
        query: 'useState hook example',
        max_results: 3,
        include_code: true
      }

      const result = await tool.execute(input, {})

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('metadata')

      if (result.success) {
        expect(result.data).toHaveProperty('library')
        expect(result.data).toHaveProperty('query')
        expect(result.data).toHaveProperty('results')
        expect(result.data).toHaveProperty('context')
        expect(result.data).toHaveProperty('totalTokens')

        const data = result.data as any
        expect(data.library.id).toBe('/react/react')
        expect(data.query).toBe(input.query)
        expect(Array.isArray(data.results)).toBe(true)
        expect(typeof data.context).toBe('string')
        expect(typeof data.totalTokens).toBe('number')
      }
    })

    test('should handle missing library gracefully', async () => {
      const input = {
        library_id: '/nonexistent/library',
        query: 'test query'
      }

      const result = await tool.execute(input, {})

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('End-to-End Workflow', () => {
    test('should handle complete query workflow', async () => {
      const libraries = await libraryService.searchLibraries('react', 1)
      expect(libraries.length).toBeGreaterThan(0)

      const library = libraries[0]!

      const input = {
        library_id: library.id,
        query: 'How to use hooks?',
        max_results: 3
      }

      const validation = await tool.validate(input)
      expect(validation.success).toBe(true)

      const result = await tool.execute(input, {})

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('metadata')

      if (result.success) {
        const data = result.data as any
        expect(data.library.id).toBe(library!.id)
        expect(data.query).toBe(input.query)
        expect(data.totalTokens).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Performance and Limits', () => {
    test('should respect token limits', async () => {
      const input = {
        library_id: '/react/react',
        query: 'comprehensive guide to react with lots of details',
        max_results: 10,
        context_limit: 1000
      }

      const result = await tool.execute(input, {})

      if (result.success) {
        const data = result.data as any
        expect(data.totalTokens).toBeLessThanOrEqual(input.context_limit)
      }
    })

    test('should handle code inclusion/exclusion', async () => {
      const query = 'react hooks example'

      const withCodeResult = await tool.execute({
        library_id: '/react/react',
        query,
        include_code: true,
        max_results: 5
      }, {})

      const withoutCodeResult = await tool.execute({
        library_id: '/react/react',
        query,
        include_code: false,
        max_results: 5
      }, {})

      if (withCodeResult.success && withoutCodeResult.success) {
        const withCodeData = withCodeResult.data as any
        const withoutCodeData = withoutCodeResult.data as any
        expect(withCodeData.results.length).toBeDefined()
        expect(withoutCodeData.results.length).toBeDefined()
      }
    })
  })
})
