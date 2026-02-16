import { MultiModelEmbeddingService } from '../../src/services/embeddings/multi-model.service'

describe('MultiModelEmbeddingService', () => {
  let service: MultiModelEmbeddingService

  beforeEach(() => {
    service = new MultiModelEmbeddingService()
    service.registerModel({
      id: 'text-embedding-3-small', name: 'OpenAI Small', provider: 'openai',
      dimensions: 1536, maxTokens: 8191, costPer1KTokens: 0.00002,
      latencyMs: 100, enabled: true, bestFor: ['search', 'similarity'],
    })
    service.registerModel({
      id: 'text-embedding-3-large', name: 'OpenAI Large', provider: 'openai',
      dimensions: 3072, maxTokens: 8191, costPer1KTokens: 0.00013,
      latencyMs: 200, enabled: true, bestFor: ['classification', 'clustering'],
    })
    service.registerModel({
      id: 'code-embed', name: 'Code Embedder', provider: 'custom',
      dimensions: 768, maxTokens: 4096, costPer1KTokens: 0.0001,
      latencyMs: 150, enabled: true, bestFor: ['code'],
    })

    service.setGenerator(async (texts, modelId) => {
      return texts.map(() => Array(3).fill(0).map(() => Math.random()))
    })
  })

  describe('Model management', () => {
    it('registers and lists models', () => {
      expect(service.getModels().length).toBe(3)
    })

    it('gets a model by ID', () => {
      expect(service.getModel('text-embedding-3-small')?.name).toBe('OpenAI Small')
    })

    it('removes a model', () => {
      expect(service.removeModel('code-embed')).toBe(true)
      expect(service.getModels().length).toBe(2)
    })

    it('lists only enabled models', () => {
      service.registerModel({
        id: 'disabled', name: 'Disabled', provider: 'custom',
        dimensions: 128, maxTokens: 512, costPer1KTokens: 0,
        latencyMs: 50, enabled: false, bestFor: [],
      })
      expect(service.getEnabledModels().length).toBe(3)
    })
  })

  describe('Model selection', () => {
    it('selects best model for use case', () => {
      const model = service.selectModel('search')
      expect(model?.id).toBe('text-embedding-3-small') // cheapest search model
    })

    it('selects code model for code use case', () => {
      const model = service.selectModel('code')
      expect(model?.id).toBe('code-embed')
    })

    it('falls back to cheapest when no use case match', () => {
      const model = service.selectModel('unknown-use-case')
      expect(model).not.toBeNull()
    })

    it('returns null when no models enabled', () => {
      const empty = new MultiModelEmbeddingService()
      expect(empty.selectModel()).toBeNull()
    })
  })

  describe('Embedding generation', () => {
    it('generates an embedding', async () => {
      const result = await service.embed({ text: 'hello world' })
      expect(result.vector).toBeDefined()
      expect(result.vector.length).toBe(3)
      expect(result.modelId).toBeDefined()
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.cost).toBeGreaterThan(0)
    })

    it('generates with specific model', async () => {
      const result = await service.embed({ text: 'test', modelId: 'code-embed' })
      expect(result.modelId).toBe('code-embed')
    })

    it('generates batch embeddings', async () => {
      const results = await service.embedBatch(['hello', 'world'], 'text-embedding-3-small')
      expect(results.length).toBe(2)
      expect(results[0].modelId).toBe('text-embedding-3-small')
    })

    it('throws without generator', async () => {
      const s = new MultiModelEmbeddingService()
      s.registerModel({
        id: 'test', name: 'Test', provider: 'custom',
        dimensions: 3, maxTokens: 100, costPer1KTokens: 0,
        latencyMs: 10, enabled: true, bestFor: [],
      })
      await expect(s.embed({ text: 'test', modelId: 'test' })).rejects.toThrow()
    })
  })

  describe('Fallback chains', () => {
    it('falls back to next model on failure', async () => {
      let callCount = 0
      service.setGenerator(async (texts, modelId) => {
        callCount++
        if (modelId === 'text-embedding-3-small') throw new Error('fail')
        return texts.map(() => [1, 2, 3])
      })
      service.setFallbackChain('text-embedding-3-small', ['text-embedding-3-large'])

      const result = await service.embed({ text: 'test', modelId: 'text-embedding-3-small' })
      expect(result.modelId).toBe('text-embedding-3-large')
      expect(callCount).toBe(2)
    })

    it('gets fallback chain', () => {
      service.setFallbackChain('a', ['b', 'c'])
      expect(service.getFallbackChain('a')).toEqual(['b', 'c'])
      expect(service.getFallbackChain('unknown')).toEqual([])
    })
  })

  describe('Multi-model comparison', () => {
    it('embeds with multiple models in parallel', async () => {
      const results = await service.embedWithMultipleModels('test', ['text-embedding-3-small', 'code-embed'])
      expect(results.size).toBe(2)
      expect(results.has('text-embedding-3-small')).toBe(true)
      expect(results.has('code-embed')).toBe(true)
    })
  })

  describe('Statistics', () => {
    it('tracks usage stats', async () => {
      await service.embed({ text: 'hello' })
      await service.embed({ text: 'world' })

      const stats = service.getStats()
      expect(stats.size).toBeGreaterThan(0)
      const anyStats = Array.from(stats.values()).find(s => s.calls > 0)
      expect(anyStats).toBeDefined()
      expect(anyStats!.calls).toBeGreaterThan(0)
    })

    it('resets stats', async () => {
      await service.embed({ text: 'test' })
      service.resetStats()
      const stats = service.getStats()
      for (const s of stats.values()) {
        expect(s.calls).toBe(0)
      }
    })
  })
})
