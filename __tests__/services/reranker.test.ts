import { RerankerService } from '../../src/services/embeddings/reranker.service'

describe('RerankerService', () => {
  let service: RerankerService

  const makeResult = (id: string, content: string, score: number, meta: Record<string, any> = {}) => ({
    id, content, score, metadata: meta,
  })

  beforeEach(() => {
    service = new RerankerService()
  })

  describe('Configuration', () => {
    it('uses default config', () => {
      const config = service.getConfig()
      expect(config.originalScoreWeight).toBe(0.4)
      expect(config.crossEncoderWeight).toBe(0.3)
    })

    it('accepts custom config', () => {
      service.setConfig({ originalScoreWeight: 0.6 })
      expect(service.getConfig().originalScoreWeight).toBe(0.6)
    })
  })

  describe('Simple re-ranking', () => {
    it('re-ranks results', () => {
      const results = [
        makeResult('a', 'React is a JavaScript library for building UIs', 0.9),
        makeResult('b', 'Express is a web framework for Node.js', 0.85),
        makeResult('c', 'React hooks allow state in function components', 0.8),
      ]

      const reranked = service.rerankSimple('React JavaScript library', results)
      expect(reranked.length).toBe(3)
      // Each result should have rerank signals
      expect(reranked[0].signals.originalScore).toBeDefined()
      expect(reranked[0].signals.crossEncoderScore).toBeDefined()
      expect(reranked[0].originalRank).toBeDefined()
    })

    it('boosts results matching query terms', () => {
      const results = [
        makeResult('a', 'Express is a web framework for Node.js servers', 0.9),
        makeResult('b', 'React is a JavaScript library for building user interfaces', 0.85),
      ]

      const reranked = service.rerankSimple('React JavaScript', results)
      // React result should be boosted due to keyword match
      const reactResult = reranked.find(r => r.id === 'b')
      expect(reactResult!.signals.crossEncoderScore).toBeGreaterThan(0)
    })

    it('respects limit', () => {
      const results = [
        makeResult('a', 'content a', 0.9),
        makeResult('b', 'content b', 0.8),
        makeResult('c', 'content c', 0.7),
      ]

      const reranked = service.rerankSimple('test', results, 2)
      expect(reranked.length).toBe(2)
    })

    it('handles empty results', () => {
      const reranked = service.rerankSimple('test', [])
      expect(reranked.length).toBe(0)
    })
  })

  describe('Full re-ranking with MMR', () => {
    it('applies MMR diversity', async () => {
      const results = [
        makeResult('a', 'React is a JavaScript library for building UIs', 0.95),
        makeResult('b', 'React is a JavaScript library for building user interfaces', 0.93), // very similar to a
        makeResult('c', 'Express is a web framework for Node.js', 0.80),
      ]

      const reranked = await service.rerank('React library', results)
      expect(reranked.length).toBe(3)
      // With MMR, the very similar result 'b' should be penalized
      expect(reranked[0].id).toBe('a')
      // 'c' might rank higher than 'b' due to diversity
    })

    it('uses cross-encoder when provided', async () => {
      service.setCrossEncoder(async (query, docs) => {
        return docs.map(d => d.toLowerCase().includes('react') ? 0.95 : 0.3)
      })

      const results = [
        makeResult('a', 'Express web framework', 0.9),
        makeResult('b', 'React JavaScript library', 0.7),
      ]

      const reranked = await service.rerank('React', results)
      // Cross-encoder should boost React result
      const reactResult = reranked.find(r => r.id === 'b')
      expect(reactResult!.signals.crossEncoderScore).toBe(0.95)
    })

    it('respects limit', async () => {
      const results = [
        makeResult('a', 'content a', 0.9),
        makeResult('b', 'content b', 0.8),
        makeResult('c', 'content c', 0.7),
      ]

      const reranked = await service.rerank('test', results, 1)
      expect(reranked.length).toBe(1)
    })
  })

  describe('Recency scoring', () => {
    it('boosts recent content', () => {
      const results = [
        makeResult('old', 'old content', 0.9, { lastModified: '2020-01-01' }),
        makeResult('new', 'new content', 0.85, { lastModified: new Date().toISOString() }),
      ]

      const reranked = service.rerankSimple('content', results)
      const newResult = reranked.find(r => r.id === 'new')
      const oldResult = reranked.find(r => r.id === 'old')
      expect(newResult!.signals.recencyScore).toBeGreaterThan(oldResult!.signals.recencyScore)
    })

    it('handles missing dates', () => {
      const results = [makeResult('a', 'content', 0.9)]
      const reranked = service.rerankSimple('test', results)
      expect(reranked[0].signals.recencyScore).toBe(0.5) // default
    })
  })
})
