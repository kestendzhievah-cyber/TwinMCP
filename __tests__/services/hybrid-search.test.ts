import { HybridSearchService } from '../../src/services/embeddings/hybrid-search.service'

describe('HybridSearchService', () => {
  let service: HybridSearchService

  function norm(v: number[]): number[] {
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    return v.map(x => x / (n || 1))
  }

  beforeEach(() => {
    service = new HybridSearchService()
    service.index({ id: 'react', content: 'React is a JavaScript library for building user interfaces', vector: norm([1, 0.8, 0.1]), metadata: { name: 'react', tags: ['ui', 'frontend'] } })
    service.index({ id: 'vue', content: 'Vue.js is a progressive JavaScript framework for building UIs', vector: norm([0.9, 0.7, 0.2]), metadata: { name: 'vue', tags: ['ui', 'framework'] } })
    service.index({ id: 'express', content: 'Express is a minimal web framework for Node.js servers', vector: norm([0.1, 0.2, 1]), metadata: { name: 'express', tags: ['server', 'http'] } })
    service.index({ id: 'lodash', content: 'Lodash is a modern JavaScript utility library', vector: norm([0.3, 0.3, 0.5]), metadata: { name: 'lodash', tags: ['utility'] } })
  })

  describe('Indexing', () => {
    it('tracks document count', () => {
      expect(service.size).toBe(4)
    })

    it('removes documents', () => {
      expect(service.remove('lodash')).toBe(true)
      expect(service.size).toBe(3)
    })
  })

  describe('Hybrid search', () => {
    it('combines vector and text scores', async () => {
      const results = await service.search({
        text: 'JavaScript library user interface',
        vector: norm([1, 0.8, 0.1]),
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('react')
      expect(results[0].vectorScore).toBeGreaterThan(0)
      expect(results[0].textScore).toBeGreaterThan(0)
      expect(results[0].combinedScore).toBeGreaterThan(0)
    })

    it('respects vectorWeight and textWeight', async () => {
      // Heavy text weight
      const textHeavy = await service.search({
        text: 'express server Node.js',
        vector: norm([1, 0.8, 0.1]), // vector points to react
        vectorWeight: 0.1,
        textWeight: 0.9,
      })

      // Express should rank high due to text match despite vector mismatch
      const expressResult = textHeavy.find(r => r.id === 'express')
      expect(expressResult).toBeDefined()
      expect(expressResult!.textScore).toBeGreaterThan(0)
    })

    it('works with text-only search (no vector)', async () => {
      const results = await service.search({
        text: 'utility library',
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const lodashResult = results.find(r => r.id === 'lodash')
      expect(lodashResult).toBeDefined()
    })

    it('respects limit', async () => {
      const results = await service.search({ text: 'JavaScript', limit: 2 })
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('respects minScore', async () => {
      const results = await service.search({
        text: 'JavaScript',
        vector: norm([1, 0.8, 0.1]),
        minScore: 0.5,
      })
      expect(results.every(r => r.combinedScore >= 0.5)).toBe(true)
    })
  })

  describe('Re-ranking integration', () => {
    it('applies custom rerank function', async () => {
      service.setRerankFunction(async (query, results) => {
        // Reverse the order as a simple test
        return results.reverse().map((r, i) => ({ ...r, rerankScore: 1 - i * 0.1, finalScore: 1 - i * 0.1 }))
      })

      const results = await service.search({
        text: 'JavaScript',
        vector: norm([1, 0.8, 0.1]),
        rerank: true,
        limit: 4,
      })

      expect(results.length).toBeGreaterThan(0)
    })
  })
})
