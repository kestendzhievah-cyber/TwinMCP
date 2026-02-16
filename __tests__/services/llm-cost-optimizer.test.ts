import { LLMCostOptimizerService } from '../../src/services/llm/cost-optimizer.service'

describe('LLMCostOptimizerService', () => {
  let service: LLMCostOptimizerService

  beforeEach(() => {
    service = new LLMCostOptimizerService()
    service.registerModel({ modelId: 'gpt-4', provider: 'openai', inputCostPer1K: 0.03, outputCostPer1K: 0.06, quality: 9, latencyMs: 2000, contextWindow: 8192, capabilities: ['functions', 'vision', 'streaming'] })
    service.registerModel({ modelId: 'gpt-3.5-turbo', provider: 'openai', inputCostPer1K: 0.0015, outputCostPer1K: 0.002, quality: 7, latencyMs: 800, contextWindow: 16384, capabilities: ['functions', 'streaming'] })
    service.registerModel({ modelId: 'claude-3-haiku', provider: 'anthropic', inputCostPer1K: 0.00025, outputCostPer1K: 0.00125, quality: 8, latencyMs: 500, contextWindow: 200000, capabilities: ['functions', 'vision', 'streaming'] })
  })

  describe('Model registry', () => {
    it('registers and lists models', () => {
      expect(service.getModels().length).toBe(3)
    })

    it('gets a model by ID', () => {
      expect(service.getModel('gpt-4')?.quality).toBe(9)
    })

    it('removes a model', () => {
      expect(service.removeModel('gpt-4')).toBe(true)
      expect(service.getModels().length).toBe(2)
    })
  })

  describe('Optimization', () => {
    it('selects cheapest model for cost priority', () => {
      const result = service.optimize({ task: 'simple question', priority: 'cost', tokenEstimate: 500 })
      expect(result.selectedModel.modelId).toBe('claude-3-haiku')
      expect(result.estimatedCost).toBeGreaterThan(0)
    })

    it('selects highest quality model for quality priority', () => {
      const result = service.optimize({ task: 'complex analysis', priority: 'quality', tokenEstimate: 500 })
      expect(result.selectedModel.quality).toBeGreaterThanOrEqual(8)
    })

    it('selects fastest model for speed priority', () => {
      const result = service.optimize({ task: 'quick lookup', priority: 'speed', tokenEstimate: 500 })
      expect(result.selectedModel.latencyMs).toBeLessThanOrEqual(800)
    })

    it('filters by required capabilities', () => {
      const result = service.optimize({ task: 'image analysis', requiredCapabilities: ['vision'], tokenEstimate: 500 })
      expect(result.selectedModel.capabilities).toContain('vision')
    })

    it('respects max cost constraint', () => {
      const result = service.optimize({ task: 'test', maxCostPerRequest: 0.001, tokenEstimate: 500 })
      expect(result.estimatedCost).toBeLessThanOrEqual(0.001)
    })

    it('respects min quality constraint', () => {
      const result = service.optimize({ task: 'test', minQuality: 8, tokenEstimate: 500 })
      expect(result.selectedModel.quality).toBeGreaterThanOrEqual(8)
    })

    it('provides alternatives', () => {
      const result = service.optimize({ task: 'test', priority: 'balanced', tokenEstimate: 500 })
      expect(result.alternatives.length).toBeGreaterThan(0)
    })

    it('calculates savings', () => {
      const result = service.optimize({ task: 'test', priority: 'cost', tokenEstimate: 500 })
      expect(result.estimatedSavings).toBeGreaterThanOrEqual(0)
    })

    it('falls back to cheapest when no match', () => {
      const result = service.optimize({ task: 'test', requiredCapabilities: ['nonexistent'], tokenEstimate: 500 })
      expect(result.reason).toContain('fallback')
    })

    it('throws when no models registered', () => {
      const empty = new LLMCostOptimizerService()
      expect(() => empty.optimize({ task: 'test' })).toThrow('No models registered')
    })
  })

  describe('Budget management', () => {
    it('adds and lists budgets', () => {
      service.addBudget({ id: 'daily', name: 'Daily', limitAmount: 1.0, period: 'daily', currentSpend: 0, alertThreshold: 0.8, autoDowngrade: true, downgradeModelId: 'gpt-3.5-turbo' })
      expect(service.getBudgets().length).toBe(1)
    })

    it('removes budgets', () => {
      service.addBudget({ id: 'daily', name: 'Daily', limitAmount: 1.0, period: 'daily', currentSpend: 0, alertThreshold: 0.8, autoDowngrade: false })
      expect(service.removeBudget('daily')).toBe(true)
    })

    it('allows requests within budget', () => {
      service.addBudget({ id: 'daily', name: 'Daily', limitAmount: 10.0, period: 'daily', currentSpend: 0, alertThreshold: 0.8, autoDowngrade: true })
      const check = service.checkBudget(0.01)
      expect(check.allowed).toBe(true)
    })

    it('triggers downgrade when over budget', () => {
      service.addBudget({ id: 'daily', name: 'Daily', limitAmount: 0.001, period: 'daily', currentSpend: 0, alertThreshold: 0.5, autoDowngrade: true, downgradeModelId: 'gpt-3.5-turbo' })
      service.recordUsage({ modelId: 'gpt-4', provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 0.001 })
      const check = service.checkBudget(0.01)
      expect(check.downgradeModel).toBe('gpt-3.5-turbo')
    })

    it('triggers alert callbacks', () => {
      const alerts: any[] = []
      service.onBudgetAlert((b, s) => alerts.push({ budget: b.id, spend: s }))
      service.addBudget({ id: 'daily', name: 'Daily', limitAmount: 0.01, period: 'daily', currentSpend: 0, alertThreshold: 0.5, autoDowngrade: true })
      service.recordUsage({ modelId: 'gpt-4', provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 0.008 })
      service.checkBudget(0.001)
      expect(alerts.length).toBeGreaterThan(0)
    })
  })

  describe('Usage tracking', () => {
    it('records and retrieves usage', () => {
      service.recordUsage({ modelId: 'gpt-4', provider: 'openai', inputTokens: 100, outputTokens: 50, cost: 0.005 })
      service.recordUsage({ modelId: 'claude-3-haiku', provider: 'anthropic', inputTokens: 200, outputTokens: 100, cost: 0.001 })
      expect(service.getUsage().length).toBe(2)
      expect(service.getTotalSpend()).toBeCloseTo(0.006)
    })

    it('breaks down by model', () => {
      service.recordUsage({ modelId: 'gpt-4', provider: 'openai', inputTokens: 100, outputTokens: 50, cost: 0.005 })
      service.recordUsage({ modelId: 'gpt-4', provider: 'openai', inputTokens: 100, outputTokens: 50, cost: 0.005 })
      const byModel = service.getSpendByModel()
      expect(byModel['gpt-4']).toBeCloseTo(0.01)
    })

    it('breaks down by provider', () => {
      service.recordUsage({ modelId: 'gpt-4', provider: 'openai', inputTokens: 100, outputTokens: 50, cost: 0.005 })
      service.recordUsage({ modelId: 'claude-3-haiku', provider: 'anthropic', inputTokens: 200, outputTokens: 100, cost: 0.001 })
      const byProvider = service.getSpendByProvider()
      expect(byProvider['openai']).toBeCloseTo(0.005)
      expect(byProvider['anthropic']).toBeCloseTo(0.001)
    })
  })

  describe('Prompt compression', () => {
    it('compresses prompts', () => {
      const text = 'Please note that   this   is   a   test.\n\n\n\nIt is important to note that we need to reduce tokens.'
      const result = service.compressPrompt(text)
      expect(result.compressed.length).toBeLessThan(text.length)
      expect(result.savedTokens).toBeGreaterThan(0)
    })

    it('handles already-compact text', () => {
      const text = 'Short text.'
      const result = service.compressPrompt(text)
      expect(result.compressed).toBe(text)
    })
  })
})
