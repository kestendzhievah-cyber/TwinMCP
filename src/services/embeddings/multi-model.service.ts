/**
 * Multi-Model Embedding Service.
 *
 * Manages multiple embedding models simultaneously, allowing:
 *   - Model registry with configuration (dimensions, cost, speed)
 *   - Automatic model selection based on use case
 *   - Fallback chains when a model is unavailable
 *   - Parallel embedding generation across models
 *   - Model performance comparison
 */

export interface EmbeddingModelConfig {
  id: string
  name: string
  provider: 'openai' | 'cohere' | 'local' | 'huggingface' | 'custom'
  dimensions: number
  maxTokens: number
  costPer1KTokens: number
  /** Latency in ms (approximate) */
  latencyMs: number
  enabled: boolean
  /** Use cases this model is best for */
  bestFor: Array<'search' | 'classification' | 'clustering' | 'similarity' | 'code'>
}

export interface EmbeddingRequest {
  text: string
  modelId?: string
  useCase?: 'search' | 'classification' | 'clustering' | 'similarity' | 'code'
}

export interface EmbeddingResponse {
  vector: number[]
  modelId: string
  tokens: number
  cost: number
  latencyMs: number
}

export type EmbeddingGeneratorFn = (texts: string[], modelId: string) => Promise<number[][]>

export class MultiModelEmbeddingService {
  private models: Map<string, EmbeddingModelConfig> = new Map()
  private fallbackChains: Map<string, string[]> = new Map()
  private generator: EmbeddingGeneratorFn | null = null
  private stats: Map<string, { calls: number; totalTokens: number; totalCost: number; totalLatency: number; errors: number }> = new Map()

  /** Register an embedding model. */
  registerModel(config: EmbeddingModelConfig): void {
    this.models.set(config.id, config)
    this.stats.set(config.id, { calls: 0, totalTokens: 0, totalCost: 0, totalLatency: 0, errors: 0 })
  }

  /** Remove a model. */
  removeModel(id: string): boolean {
    this.stats.delete(id)
    return this.models.delete(id)
  }

  /** Get a model config. */
  getModel(id: string): EmbeddingModelConfig | undefined {
    return this.models.get(id)
  }

  /** List all registered models. */
  getModels(): EmbeddingModelConfig[] {
    return Array.from(this.models.values())
  }

  /** Get only enabled models. */
  getEnabledModels(): EmbeddingModelConfig[] {
    return this.getModels().filter(m => m.enabled)
  }

  /** Set the embedding generator function (for DI / testing). */
  setGenerator(fn: EmbeddingGeneratorFn): void {
    this.generator = fn
  }

  /** Define a fallback chain: if modelId fails, try each fallback in order. */
  setFallbackChain(modelId: string, fallbacks: string[]): void {
    this.fallbackChains.set(modelId, fallbacks)
  }

  /** Get the fallback chain for a model. */
  getFallbackChain(modelId: string): string[] {
    return this.fallbackChains.get(modelId) || []
  }

  /**
   * Select the best model for a given use case.
   * Prefers: enabled → bestFor match → lowest cost → lowest latency.
   */
  selectModel(useCase?: string): EmbeddingModelConfig | null {
    const enabled = this.getEnabledModels()
    if (enabled.length === 0) return null

    if (!useCase) return enabled[0]

    // Prefer models that list this use case
    const matching = enabled.filter(m => m.bestFor.includes(useCase as any))
    if (matching.length > 0) {
      return matching.sort((a, b) => a.costPer1KTokens - b.costPer1KTokens || a.latencyMs - b.latencyMs)[0]
    }

    // Fallback to cheapest enabled model
    return enabled.sort((a, b) => a.costPer1KTokens - b.costPer1KTokens)[0]
  }

  /**
   * Generate an embedding for a single text.
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.generator) throw new Error('No embedding generator configured')

    const modelId = request.modelId || this.selectModel(request.useCase)?.id
    if (!modelId) throw new Error('No suitable model found')

    const model = this.models.get(modelId)
    if (!model) throw new Error(`Model not found: ${modelId}`)

    const chain = [modelId, ...this.getFallbackChain(modelId)]

    for (const tryModelId of chain) {
      const tryModel = this.models.get(tryModelId)
      if (!tryModel || !tryModel.enabled) continue

      try {
        const start = Date.now()
        const [vector] = await this.generator([request.text], tryModelId)
        const latency = Date.now() - start
        const tokens = this.estimateTokens(request.text)
        const cost = (tokens / 1000) * tryModel.costPer1KTokens

        // Update stats
        const s = this.stats.get(tryModelId)!
        s.calls++
        s.totalTokens += tokens
        s.totalCost += cost
        s.totalLatency += latency

        return { vector, modelId: tryModelId, tokens, cost, latencyMs: latency }
      } catch {
        const s = this.stats.get(tryModelId)
        if (s) s.errors++
        // Try next in chain
      }
    }

    throw new Error(`All models in fallback chain failed for: ${modelId}`)
  }

  /**
   * Generate embeddings for multiple texts (batch).
   */
  async embedBatch(texts: string[], modelId?: string, useCase?: string): Promise<EmbeddingResponse[]> {
    if (!this.generator) throw new Error('No embedding generator configured')

    const resolvedModelId = modelId || this.selectModel(useCase)?.id
    if (!resolvedModelId) throw new Error('No suitable model found')

    const model = this.models.get(resolvedModelId)
    if (!model) throw new Error(`Model not found: ${resolvedModelId}`)

    const start = Date.now()
    const vectors = await this.generator(texts, resolvedModelId)
    const totalLatency = Date.now() - start

    return texts.map((text, i) => {
      const tokens = this.estimateTokens(text)
      const cost = (tokens / 1000) * model.costPer1KTokens

      const s = this.stats.get(resolvedModelId)!
      s.calls++
      s.totalTokens += tokens
      s.totalCost += cost
      s.totalLatency += totalLatency / texts.length

      return {
        vector: vectors[i],
        modelId: resolvedModelId,
        tokens,
        cost,
        latencyMs: totalLatency / texts.length,
      }
    })
  }

  /**
   * Generate embeddings with multiple models in parallel (for comparison / A/B testing).
   */
  async embedWithMultipleModels(text: string, modelIds: string[]): Promise<Map<string, EmbeddingResponse>> {
    const results = new Map<string, EmbeddingResponse>()

    const promises = modelIds.map(async (id) => {
      try {
        const response = await this.embed({ text, modelId: id })
        results.set(id, response)
      } catch { /* skip failed models */ }
    })

    await Promise.all(promises)
    return results
  }

  /** Get usage statistics per model. */
  getStats(): Map<string, { calls: number; totalTokens: number; totalCost: number; avgLatency: number; errorRate: number }> {
    const result = new Map<string, any>()
    for (const [id, s] of this.stats) {
      result.set(id, {
        calls: s.calls,
        totalTokens: s.totalTokens,
        totalCost: s.totalCost,
        avgLatency: s.calls > 0 ? s.totalLatency / s.calls : 0,
        errorRate: s.calls + s.errors > 0 ? s.errors / (s.calls + s.errors) : 0,
      })
    }
    return result
  }

  /** Reset stats for all models. */
  resetStats(): void {
    for (const [id] of this.stats) {
      this.stats.set(id, { calls: 0, totalTokens: 0, totalCost: 0, totalLatency: 0, errors: 0 })
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

export const multiModelEmbeddingService = new MultiModelEmbeddingService()
