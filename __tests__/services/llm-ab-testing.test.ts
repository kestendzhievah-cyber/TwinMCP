import { LLMABTestingService } from '../../src/services/llm/llm-ab-testing.service'

describe('LLMABTestingService', () => {
  let service: LLMABTestingService

  function makeExperiment(id: string = 'exp-1') {
    return {
      id,
      name: 'GPT-4 vs Claude',
      status: 'draft' as const,
      variants: [
        { id: 'v-gpt4', name: 'GPT-4', provider: 'openai', modelId: 'gpt-4' },
        { id: 'v-claude', name: 'Claude Haiku', provider: 'anthropic', modelId: 'claude-3-haiku' },
      ],
      trafficSplit: { 'v-gpt4': 0.5, 'v-claude': 0.5 },
      config: { minSamples: 20, significanceThreshold: 0.05, primaryMetric: 'quality' as const },
    }
  }

  beforeEach(() => {
    service = new LLMABTestingService()
  })

  describe('Experiment lifecycle', () => {
    it('creates and retrieves', () => {
      service.createExperiment(makeExperiment())
      expect(service.getExperiment('exp-1')).toBeDefined()
      expect(service.getExperiments().length).toBe(1)
    })

    it('starts an experiment', () => {
      service.createExperiment(makeExperiment())
      expect(service.startExperiment('exp-1')).toBe(true)
      expect(service.getExperiment('exp-1')!.status).toBe('running')
    })

    it('pauses and completes', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      expect(service.pauseExperiment('exp-1')).toBe(true)
      expect(service.getExperiment('exp-1')!.status).toBe('paused')
    })

    it('removes experiment and results', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      service.record('exp-1', 'v-gpt4', 0.9, 100, 0.01, 500, 200)
      service.removeExperiment('exp-1')
      expect(service.getExperiments().length).toBe(0)
      expect(service.totalResults).toBe(0)
    })
  })

  describe('Traffic routing', () => {
    it('selects variant for running experiment', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      const v = service.selectVariant('exp-1')
      expect(v).not.toBeNull()
      expect(['v-gpt4', 'v-claude']).toContain(v!.id)
    })

    it('returns null for non-running', () => {
      service.createExperiment(makeExperiment())
      expect(service.selectVariant('exp-1')).toBeNull()
    })
  })

  describe('Results recording', () => {
    it('records and retrieves', () => {
      service.createExperiment(makeExperiment())
      service.record('exp-1', 'v-gpt4', 0.92, 120, 0.01, 500, 200)
      service.record('exp-1', 'v-claude', 0.88, 80, 0.002, 500, 200)
      expect(service.getResults('exp-1').length).toBe(2)
    })
  })

  describe('Reporting', () => {
    beforeEach(() => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      for (let i = 0; i < 30; i++) {
        service.record('exp-1', 'v-gpt4', 0.90 + Math.random() * 0.05, 1500 + Math.random() * 500, 0.03, 500, 200, 4.5)
        service.record('exp-1', 'v-claude', 0.80 + Math.random() * 0.05, 400 + Math.random() * 200, 0.001, 500, 200, 3.8)
      }
    })

    it('generates report with variant stats', () => {
      const report = service.getReport('exp-1')
      expect(report.variants.length).toBe(2)
      const gpt4 = report.variants.find(v => v.variantId === 'v-gpt4')!
      expect(gpt4.sampleSize).toBe(30)
      expect(gpt4.avgQuality).toBeGreaterThan(0.89)
      expect(gpt4.p95Latency).toBeGreaterThan(0)
    })

    it('determines winner by quality', () => {
      const report = service.getReport('exp-1')
      expect(report.isSignificant).toBe(true)
      expect(report.winner).toBeDefined()
      expect(report.winner!.variantId).toBe('v-gpt4')
    })

    it('provides recommendation', () => {
      const report = service.getReport('exp-1')
      expect(report.recommendation).toContain('Recommend')
    })

    it('auto-selects winner on completion', () => {
      service.completeExperiment('exp-1')
      expect(service.getExperiment('exp-1')!.winner).toBe('v-gpt4')
    })
  })

  describe('Cost-optimized experiment', () => {
    it('selects cheapest as winner when primary metric is cost', () => {
      const exp = makeExperiment('exp-cost')
      ;(exp.config as any).primaryMetric = 'cost'
      service.createExperiment(exp)
      service.startExperiment('exp-cost')

      for (let i = 0; i < 25; i++) {
        service.record('exp-cost', 'v-gpt4', 0.9, 1500, 0.03, 500, 200)
        service.record('exp-cost', 'v-claude', 0.85, 400, 0.001, 500, 200)
      }

      const report = service.getReport('exp-cost')
      expect(report.winner?.variantId).toBe('v-claude')
    })
  })
})
