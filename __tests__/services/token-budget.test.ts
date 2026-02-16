import { TokenBudgetService, createBudgetForModel, MODEL_TOKEN_LIMITS } from '../../src/services/embeddings/token-budget.service'

describe('TokenBudgetService', () => {
  let service: TokenBudgetService

  beforeEach(() => {
    service = new TokenBudgetService(8192, 1024)
  })

  describe('Configuration', () => {
    it('computes available budget', () => {
      expect(service.getAvailableBudget()).toBe(7168) // 8192 - 1024
    })

    it('updates total budget', () => {
      service.setTotalBudget(16000)
      expect(service.getAvailableBudget()).toBe(14976)
    })

    it('updates reserve tokens', () => {
      service.setReserveTokens(2048)
      expect(service.getAvailableBudget()).toBe(6144)
    })
  })

  describe('Section management', () => {
    it('adds and lists sections', () => {
      service.addSection({
        id: 'system', name: 'System Prompt', priority: 1,
        minTokens: 100, maxTokens: 500, currentTokens: 0,
        content: '', compressible: false,
      })
      expect(service.getSections().length).toBe(1)
    })

    it('removes sections', () => {
      service.addSection({
        id: 'system', name: 'System', priority: 1,
        minTokens: 100, maxTokens: 500, currentTokens: 0,
        content: '', compressible: false,
      })
      expect(service.removeSection('system')).toBe(true)
      expect(service.getSections().length).toBe(0)
    })

    it('updates section content', () => {
      service.addSection({
        id: 'docs', name: 'Docs', priority: 2,
        minTokens: 0, maxTokens: 4000, currentTokens: 0,
        content: '', compressible: true,
      })
      const text = 'A'.repeat(400) // ~100 tokens
      expect(service.updateSection('docs', text)).toBe(true)
      expect(service.getSections()[0].currentTokens).toBe(100)
    })

    it('returns false for unknown section update', () => {
      expect(service.updateSection('unknown', 'text')).toBe(false)
    })

    it('sorts sections by priority', () => {
      service.addSection({ id: 'low', name: 'Low', priority: 3, minTokens: 0, maxTokens: 100, currentTokens: 0, content: '', compressible: false })
      service.addSection({ id: 'high', name: 'High', priority: 1, minTokens: 0, maxTokens: 100, currentTokens: 0, content: '', compressible: false })
      expect(service.getSections()[0].id).toBe('high')
    })
  })

  describe('Allocation', () => {
    beforeEach(() => {
      service.addSection({
        id: 'system', name: 'System Prompt', priority: 1,
        minTokens: 200, maxTokens: 500, currentTokens: 300,
        content: 'A'.repeat(1200), compressible: false,
      })
      service.addSection({
        id: 'docs', name: 'Retrieved Docs', priority: 2,
        minTokens: 100, maxTokens: 4000, currentTokens: 2000,
        content: 'B'.repeat(8000), compressible: true,
      })
      service.addSection({
        id: 'history', name: 'Chat History', priority: 3,
        minTokens: 50, maxTokens: 2000, currentTokens: 500,
        content: 'C'.repeat(2000), compressible: true,
      })
    })

    it('allocates tokens within budget', () => {
      const result = service.allocate()
      expect(result.totalUsed).toBeLessThanOrEqual(service.getAvailableBudget())
      expect(result.overBudget).toBe(false)
    })

    it('allocates to all sections', () => {
      const result = service.allocate()
      expect(result.sections.length).toBe(3)
      expect(result.sections.every(s => s.allocatedTokens > 0)).toBe(true)
    })

    it('respects priority order', () => {
      const result = service.allocate()
      const systemSection = result.sections.find(s => s.id === 'system')!
      // System prompt (priority 1) should get its full allocation
      expect(systemSection.allocatedTokens).toBeGreaterThanOrEqual(200)
    })

    it('trims content when over allocation', () => {
      // Make docs very large
      service.updateSection('docs', 'X'.repeat(40000)) // ~10000 tokens

      const result = service.allocate()
      const docsSection = result.sections.find(s => s.id === 'docs')!
      expect(docsSection.trimmed).toBe(true)
      expect(docsSection.content.length).toBeLessThan(40000)
    })

    it('uses compression function when available', () => {
      let compressionCalled = false
      service.setCompressionFn((content, targetTokens) => {
        compressionCalled = true
        return content.slice(0, targetTokens * 4)
      })

      service.updateSection('docs', 'X'.repeat(40000))
      service.allocate()

      expect(compressionCalled).toBe(true)
    })

    it('redistributes unused budget', () => {
      // System only uses 50 tokens but has min 200
      service.updateSection('system', 'A'.repeat(200)) // ~50 tokens

      const result = service.allocate()
      // Docs should get more than its min since system underused
      const docsSection = result.sections.find(s => s.id === 'docs')!
      expect(docsSection.allocatedTokens).toBeGreaterThan(100)
    })
  })

  describe('Budget checks', () => {
    it('reports within budget', () => {
      service.addSection({
        id: 'small', name: 'Small', priority: 1,
        minTokens: 0, maxTokens: 100, currentTokens: 50,
        content: 'A'.repeat(200), compressible: false,
      })
      expect(service.isWithinBudget()).toBe(true)
    })

    it('reports over budget', () => {
      service.addSection({
        id: 'huge', name: 'Huge', priority: 1,
        minTokens: 0, maxTokens: 100000, currentTokens: 100000,
        content: 'A'.repeat(400000), compressible: false,
      })
      expect(service.isWithinBudget()).toBe(false)
    })
  })

  describe('Usage summary', () => {
    it('generates usage summary', () => {
      service.addSection({
        id: 'system', name: 'System', priority: 1,
        minTokens: 100, maxTokens: 500, currentTokens: 300,
        content: 'A'.repeat(1200), compressible: false,
      })
      service.addSection({
        id: 'docs', name: 'Docs', priority: 2,
        minTokens: 0, maxTokens: 4000, currentTokens: 2000,
        content: 'B'.repeat(8000), compressible: true,
      })

      const summary = service.getUsageSummary()
      expect(summary.totalBudget).toBe(8192)
      expect(summary.reserveTokens).toBe(1024)
      expect(summary.currentUsage).toBe(2300)
      expect(summary.utilizationPercent).toBeGreaterThan(0)
      expect(summary.sectionBreakdown.length).toBe(2)
    })
  })

  describe('Model presets', () => {
    it('creates budget for known models', () => {
      const budget = createBudgetForModel('gpt-4')
      expect(budget.getAvailableBudget()).toBe(8192 - Math.round(8192 * 0.25))
    })

    it('creates budget for GPT-4 Turbo', () => {
      const budget = createBudgetForModel('gpt-4-turbo')
      expect(budget.getAvailableBudget()).toBe(128000 - Math.round(128000 * 0.25))
    })

    it('falls back to 8192 for unknown models', () => {
      const budget = createBudgetForModel('unknown-model')
      expect(budget.getAvailableBudget()).toBe(8192 - Math.round(8192 * 0.25))
    })

    it('has correct model limits', () => {
      expect(MODEL_TOKEN_LIMITS['gpt-4']).toBe(8192)
      expect(MODEL_TOKEN_LIMITS['claude-3-opus']).toBe(200000)
    })
  })

  describe('Token estimation', () => {
    it('estimates tokens from text', () => {
      expect(service.estimateTokens('hello world')).toBe(3) // 11 chars / 4
    })

    it('estimates empty text as 0', () => {
      expect(service.estimateTokens('')).toBe(0)
    })
  })
})
