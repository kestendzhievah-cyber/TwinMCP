import { ExecutiveSummaryService } from '../../src/services/analytics/executive-summary.service'

describe('ExecutiveSummaryService', () => {
  let service: ExecutiveSummaryService

  beforeEach(() => {
    service = new ExecutiveSummaryService()
  })

  describe('KPI computation', () => {
    it('computes upward trend', () => {
      const kpi = service.computeKPI({ name: 'Revenue', current: 120, previous: 100, unit: '$', higherIsBetter: true })
      expect(kpi.trend).toBe('up')
      expect(kpi.changePercent).toBe(20)
      expect(kpi.status).toBe('good')
    })

    it('computes downward trend for higher-is-better', () => {
      const kpi = service.computeKPI({ name: 'Users', current: 80, previous: 100, unit: '', higherIsBetter: true })
      expect(kpi.trend).toBe('down')
      expect(kpi.status).toBe('critical')
    })

    it('computes stable trend', () => {
      const kpi = service.computeKPI({ name: 'Latency', current: 100, previous: 100, unit: 'ms', higherIsBetter: false })
      expect(kpi.trend).toBe('stable')
    })

    it('handles zero previous value', () => {
      const kpi = service.computeKPI({ name: 'New', current: 50, previous: 0, unit: '', higherIsBetter: true })
      expect(kpi.changePercent).toBe(100)
    })

    it('computes good status for lower-is-better decrease', () => {
      const kpi = service.computeKPI({ name: 'Errors', current: 5, previous: 20, unit: '', higherIsBetter: false })
      expect(kpi.status).toBe('good')
    })
  })

  describe('Summary generation', () => {
    it('generates a summary', () => {
      const s = service.generate(
        'Monthly Report',
        { from: '2025-01-01', to: '2025-01-31' },
        { from: '2024-12-01', to: '2024-12-31' },
        [
          { name: 'Revenue', current: 15000, previous: 12000, unit: '$', higherIsBetter: true },
          { name: 'Churn', current: 8, previous: 5, unit: '%', higherIsBetter: false },
        ]
      )
      expect(s.kpis.length).toBe(2)
      expect(s.highlights.length).toBeGreaterThan(0)
      expect(s.recommendations.length).toBeGreaterThan(0)
    })

    it('retrieves summaries', () => {
      service.generate('A', { from: '', to: '' }, { from: '', to: '' }, [])
      service.generate('B', { from: '', to: '' }, { from: '', to: '' }, [])
      expect(service.getSummaries().length).toBe(2)
    })

    it('removes a summary', () => {
      const s = service.generate('Test', { from: '', to: '' }, { from: '', to: '' }, [])
      expect(service.removeSummary(s.id)).toBe(true)
    })
  })

  describe('Insight generation', () => {
    it('generates highlights for good KPIs', () => {
      const kpis = [service.computeKPI({ name: 'Revenue', current: 150, previous: 100, unit: '$', higherIsBetter: true })]
      expect(service.generateHighlights(kpis).length).toBeGreaterThan(0)
    })

    it('generates concerns for critical KPIs', () => {
      const kpis = [service.computeKPI({ name: 'Users', current: 50, previous: 100, unit: '', higherIsBetter: true })]
      expect(service.generateConcerns(kpis).length).toBeGreaterThan(0)
    })

    it('generates recommendations', () => {
      const kpis = [
        service.computeKPI({ name: 'Revenue', current: 50, previous: 100, unit: '$', higherIsBetter: true }),
      ]
      const recs = service.generateRecommendations(kpis)
      expect(recs.length).toBeGreaterThan(0)
      expect(recs[0]).toContain('Revenue')
    })

    it('generates healthy recommendation when all good', () => {
      const kpis = [service.computeKPI({ name: 'Revenue', current: 100, previous: 100, unit: '$', higherIsBetter: true })]
      const recs = service.generateRecommendations(kpis)
      expect(recs[0]).toContain('healthy')
    })
  })

  describe('Narrative', () => {
    it('generates narrative text', () => {
      const kpis = [
        service.computeKPI({ name: 'Revenue', current: 150, previous: 100, unit: '$', higherIsBetter: true }),
        service.computeKPI({ name: 'Errors', current: 50, previous: 10, unit: '', higherIsBetter: false }),
      ]
      const text = service.generateNarrative(kpis)
      expect(text).toContain('Revenue')
      expect(text).toContain('Errors')
    })

    it('handles empty KPIs', () => {
      expect(service.generateNarrative([])).toContain('No metrics')
    })
  })

  describe('Export', () => {
    it('exports as text', () => {
      const s = service.generate('Report', { from: '2025-01-01', to: '2025-01-31' }, { from: '2024-12-01', to: '2024-12-31' }, [
        { name: 'MRR', current: 10000, previous: 9000, unit: '$', higherIsBetter: true },
      ])
      const text = service.exportAsText(s.id)
      expect(text).not.toBeNull()
      expect(text).toContain('# Report')
      expect(text).toContain('MRR')
    })

    it('returns null for unknown summary', () => {
      expect(service.exportAsText('unknown')).toBeNull()
    })
  })
})
