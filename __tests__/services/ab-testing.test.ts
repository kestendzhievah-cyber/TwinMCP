import { ABTestingService } from '../../src/services/embeddings/ab-testing.service'

describe('ABTestingService', () => {
  let service: ABTestingService

  function makeExperiment(id: string = 'exp-1') {
    return {
      id,
      name: 'Model Comparison',
      description: 'Compare OpenAI vs Cohere embeddings',
      status: 'draft' as const,
      variants: [
        { id: 'v-openai', name: 'OpenAI', modelId: 'text-embedding-3-small' },
        { id: 'v-cohere', name: 'Cohere', modelId: 'embed-english-v3' },
      ],
      trafficSplit: { 'v-openai': 0.5, 'v-cohere': 0.5 },
    }
  }

  beforeEach(() => {
    service = new ABTestingService()
  })

  describe('Experiment management', () => {
    it('creates and retrieves experiments', () => {
      service.createExperiment(makeExperiment())
      expect(service.getExperiment('exp-1')).toBeDefined()
      expect(service.getExperiments().length).toBe(1)
    })

    it('starts an experiment', () => {
      service.createExperiment(makeExperiment())
      expect(service.startExperiment('exp-1')).toBe(true)
      expect(service.getExperiment('exp-1')!.status).toBe('running')
      expect(service.getExperiment('exp-1')!.startedAt).toBeDefined()
    })

    it('pauses a running experiment', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      expect(service.pauseExperiment('exp-1')).toBe(true)
      expect(service.getExperiment('exp-1')!.status).toBe('paused')
    })

    it('cannot pause a non-running experiment', () => {
      service.createExperiment(makeExperiment())
      expect(service.pauseExperiment('exp-1')).toBe(false)
    })

    it('completes an experiment', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      expect(service.completeExperiment('exp-1')).toBe(true)
      expect(service.getExperiment('exp-1')!.status).toBe('completed')
      expect(service.getExperiment('exp-1')!.completedAt).toBeDefined()
    })

    it('removes an experiment and its metrics', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')
      service.record('exp-1', 'v-openai', 0.9, 100, 0.001)
      expect(service.removeExperiment('exp-1')).toBe(true)
      expect(service.getExperiments().length).toBe(0)
      expect(service.totalMetrics).toBe(0)
    })
  })

  describe('Traffic routing', () => {
    it('selects a variant for running experiment', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')

      const variant = service.selectVariant('exp-1')
      expect(variant).not.toBeNull()
      expect(['v-openai', 'v-cohere']).toContain(variant!.id)
    })

    it('returns null for non-running experiment', () => {
      service.createExperiment(makeExperiment())
      expect(service.selectVariant('exp-1')).toBeNull()
    })

    it('returns null for unknown experiment', () => {
      expect(service.selectVariant('unknown')).toBeNull()
    })

    it('distributes traffic across variants', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')

      const counts: Record<string, number> = { 'v-openai': 0, 'v-cohere': 0 }
      for (let i = 0; i < 100; i++) {
        const v = service.selectVariant('exp-1')!
        counts[v.id]++
      }

      // Both should get some traffic (probabilistic, but very unlikely to fail)
      expect(counts['v-openai']).toBeGreaterThan(10)
      expect(counts['v-cohere']).toBeGreaterThan(10)
    })
  })

  describe('Metrics recording', () => {
    it('records and retrieves metrics', () => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')

      service.record('exp-1', 'v-openai', 0.92, 120, 0.001)
      service.record('exp-1', 'v-cohere', 0.88, 80, 0.0005)

      expect(service.getMetrics('exp-1').length).toBe(2)
      expect(service.getVariantMetrics('exp-1', 'v-openai').length).toBe(1)
      expect(service.totalMetrics).toBe(2)
    })

    it('records full metric objects', () => {
      service.createExperiment(makeExperiment())
      service.recordMetric({
        experimentId: 'exp-1',
        variantId: 'v-openai',
        timestamp: new Date().toISOString(),
        metrics: { relevanceScore: 0.95, latencyMs: 100, cost: 0.001, userSatisfaction: 4.5 },
      })

      expect(service.totalMetrics).toBe(1)
    })
  })

  describe('Reporting', () => {
    beforeEach(() => {
      service.createExperiment(makeExperiment())
      service.startExperiment('exp-1')

      // OpenAI: higher relevance, higher cost
      for (let i = 0; i < 40; i++) {
        service.record('exp-1', 'v-openai', 0.90 + Math.random() * 0.05, 100 + Math.random() * 50, 0.001, 4.0)
      }

      // Cohere: lower relevance, lower cost
      for (let i = 0; i < 40; i++) {
        service.record('exp-1', 'v-cohere', 0.80 + Math.random() * 0.05, 60 + Math.random() * 30, 0.0005, 3.5)
      }
    })

    it('generates a report with results per variant', () => {
      const report = service.getReport('exp-1')
      expect(report.experimentName).toBe('Model Comparison')
      expect(report.results.length).toBe(2)

      const openaiResult = report.results.find(r => r.variantId === 'v-openai')!
      expect(openaiResult.sampleSize).toBe(40)
      expect(openaiResult.avgRelevance).toBeGreaterThan(0.89)
      expect(openaiResult.avgLatency).toBeGreaterThan(0)
      expect(openaiResult.avgCost).toBeGreaterThan(0)
      expect(openaiResult.confidenceScore).toBe(1.0) // 40 samples > 30
    })

    it('determines a winner', () => {
      const report = service.getReport('exp-1')
      expect(report.statisticallySignificant).toBe(true)
      expect(report.winner).toBeDefined()
      expect(report.winner!.variantId).toBe('v-openai') // higher relevance
      expect(report.winner!.reason).toContain('higher relevance')
    })

    it('auto-selects winner on completion', () => {
      service.completeExperiment('exp-1')
      expect(service.getExperiment('exp-1')!.winner).toBe('v-openai')
    })

    it('returns unknown report for missing experiment', () => {
      const report = service.getReport('unknown')
      expect(report.status).toBe('unknown')
      expect(report.results.length).toBe(0)
    })

    it('handles no metrics gracefully', () => {
      service.createExperiment(makeExperiment('exp-2'))
      const report = service.getReport('exp-2')
      expect(report.results.every(r => r.sampleSize === 0)).toBe(true)
      expect(report.statisticallySignificant).toBe(false)
    })

    it('requires sufficient samples for significance', () => {
      service.createExperiment(makeExperiment('exp-small'))
      service.startExperiment('exp-small')
      service.record('exp-small', 'v-openai', 0.95, 100, 0.001)
      service.record('exp-small', 'v-cohere', 0.80, 80, 0.0005)

      const report = service.getReport('exp-small')
      // Only 1 sample each → confidence < 0.5 → not significant
      expect(report.statisticallySignificant).toBe(false)
    })
  })
})
