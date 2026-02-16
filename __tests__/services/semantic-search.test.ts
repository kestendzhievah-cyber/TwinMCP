import { SemanticSearchService } from '../../src/services/library/semantic-search.service'

describe('SemanticSearchService', () => {
  let service: SemanticSearchService

  beforeEach(() => {
    service = new SemanticSearchService()
  })

  // Helper: create a simple normalized vector
  function makeVector(values: number[]): number[] {
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0))
    return values.map(v => v / (norm || 1))
  }

  describe('Indexing', () => {
    it('indexes vectors and tracks size', () => {
      service.indexVector('a', makeVector([1, 0, 0]), { name: 'A' })
      service.indexVector('b', makeVector([0, 1, 0]), { name: 'B' })
      expect(service.size).toBe(2)
    })

    it('removes vectors', () => {
      service.indexVector('a', makeVector([1, 0, 0]), { name: 'A' })
      expect(service.remove('a')).toBe(true)
      expect(service.size).toBe(0)
    })

    it('returns false for unknown removal', () => {
      expect(service.remove('unknown')).toBe(false)
    })
  })

  describe('Vector search', () => {
    beforeEach(() => {
      service.indexVector('react', makeVector([1, 0.8, 0.1]), { name: 'react', description: 'UI library', tags: ['ui'] })
      service.indexVector('vue', makeVector([0.9, 0.7, 0.2]), { name: 'vue', description: 'Progressive framework', tags: ['ui'] })
      service.indexVector('express', makeVector([0.1, 0.2, 1]), { name: 'express', description: 'Web server', tags: ['server'] })
      service.indexVector('lodash', makeVector([0.3, 0.3, 0.5]), { name: 'lodash', description: 'Utility', tags: ['utility'] })
    })

    it('returns results sorted by cosine similarity', () => {
      const query = makeVector([1, 0.8, 0.1]) // similar to react
      const results = service.searchByVector(query, 10)
      expect(results[0].id).toBe('react')
      expect(results[0].score).toBeCloseTo(1.0, 1)
    })

    it('respects limit', () => {
      const results = service.searchByVector(makeVector([1, 0, 0]), 2)
      expect(results.length).toBe(2)
    })

    it('respects minScore', () => {
      const results = service.searchByVector(makeVector([1, 0.8, 0.1]), 10, 0.99)
      // Only react should be very close
      expect(results.length).toBeLessThanOrEqual(2)
      expect(results[0].id).toBe('react')
    })

    it('finds similar documents', () => {
      const similar = service.findSimilar('react', 2)
      expect(similar.length).toBe(2)
      // vue should be most similar to react
      expect(similar[0].id).toBe('vue')
      // Should not include react itself
      expect(similar.every(r => r.id !== 'react')).toBe(true)
    })
  })

  describe('Hybrid search', () => {
    beforeEach(() => {
      service.indexVector('react', makeVector([1, 0.8, 0.1]), { name: 'react', description: 'A JavaScript library for building user interfaces', tags: ['ui', 'frontend'] })
      service.indexVector('preact', makeVector([0.95, 0.75, 0.15]), { name: 'preact', description: 'Fast 3kB alternative to React', tags: ['ui', 'lightweight'] })
      service.indexVector('express', makeVector([0.1, 0.2, 1]), { name: 'express', description: 'Web framework for Node.js', tags: ['server'] })
    })

    it('combines keyword and semantic scores', () => {
      const queryVector = makeVector([1, 0.8, 0.1])
      const results = service.hybridSearch(queryVector, 'react ui library', {
        limit: 10,
        keywordWeight: 0.5,
        semanticWeight: 0.5,
      })

      // react should rank first (exact keyword match + high semantic similarity)
      expect(results[0].id).toBe('react')
      expect(results[0].keywordScore).toBeGreaterThan(0)
      expect(results[0].semanticScore).toBeGreaterThan(0)
    })

    it('keyword weight boosts keyword matches', () => {
      const queryVector = makeVector([0.1, 0.2, 1]) // semantically close to express
      const results = service.hybridSearch(queryVector, 'react', {
        keywordWeight: 0.9,
        semanticWeight: 0.1,
      })

      // With heavy keyword weight, react should rank high despite low semantic similarity
      const reactResult = results.find(r => r.id === 'react')
      expect(reactResult).toBeDefined()
      expect(reactResult!.keywordScore).toBeGreaterThan(0)
    })
  })

  describe('Embedding provider', () => {
    it('throws if no provider configured for search', async () => {
      await expect(service.search('test')).rejects.toThrow('Embedding provider not configured')
    })

    it('throws if no provider configured for indexDocument', async () => {
      await expect(service.indexDocument('id', 'text', { name: 'test' })).rejects.toThrow('Embedding provider not configured')
    })

    it('uses provider for text-based search', async () => {
      const mockProvider = jest.fn().mockResolvedValue([makeVector([1, 0, 0])])
      service.setEmbeddingProvider(mockProvider)
      service.indexVector('a', makeVector([1, 0, 0]), { name: 'A' })

      const results = await service.search('test query')
      expect(mockProvider).toHaveBeenCalledWith(['test query'])
      expect(results.length).toBe(1)
    })

    it('uses provider for document indexing', async () => {
      const mockProvider = jest.fn().mockResolvedValue([makeVector([0, 1, 0])])
      service.setEmbeddingProvider(mockProvider)

      await service.indexDocument('doc-1', 'some text', { name: 'Doc' })
      expect(mockProvider).toHaveBeenCalledWith(['some text'])
      expect(service.size).toBe(1)
    })
  })
})
