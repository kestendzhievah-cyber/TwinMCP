import { CostMonitorService } from '../../src/services/embeddings/cost-monitor.service'

describe('CostMonitorService', () => {
  let service: CostMonitorService

  beforeEach(() => {
    service = new CostMonitorService()
  })

  describe('Recording', () => {
    it('records a cost entry', () => {
      const entry = service.record({ modelId: 'gpt-4', tokens: 100, cost: 0.003, operation: 'embed' })
      expect(entry.id).toBeDefined()
      expect(entry.timestamp).toBeDefined()
      expect(service.size).toBe(1)
    })

    it('records multiple entries', () => {
      service.record({ modelId: 'gpt-4', tokens: 100, cost: 0.003, operation: 'embed' })
      service.record({ modelId: 'gpt-4', tokens: 200, cost: 0.006, operation: 'search' })
      service.record({ modelId: 'claude', tokens: 150, cost: 0.004, operation: 'embed' })
      expect(service.size).toBe(3)
    })
  })

  describe('Summaries', () => {
    beforeEach(() => {
      service.record({ modelId: 'gpt-4', tokens: 100, cost: 0.003, operation: 'embed' })
      service.record({ modelId: 'gpt-4', tokens: 200, cost: 0.006, operation: 'search' })
      service.record({ modelId: 'claude', tokens: 150, cost: 0.004, operation: 'embed' })
    })

    it('generates a cost summary', () => {
      const from = new Date(Date.now() - 60000)
      const to = new Date(Date.now() + 60000)
      const summary = service.getSummary(from, to)

      expect(summary.totalCost).toBeCloseTo(0.013)
      expect(summary.totalTokens).toBe(450)
      expect(summary.totalOperations).toBe(3)
    })

    it('breaks down by model', () => {
      const from = new Date(Date.now() - 60000)
      const to = new Date(Date.now() + 60000)
      const summary = service.getSummary(from, to)

      expect(summary.byModel['gpt-4'].operations).toBe(2)
      expect(summary.byModel['claude'].operations).toBe(1)
    })

    it('breaks down by operation', () => {
      const from = new Date(Date.now() - 60000)
      const to = new Date(Date.now() + 60000)
      const summary = service.getSummary(from, to)

      expect(summary.byOperation['embed'].operations).toBe(2)
      expect(summary.byOperation['search'].operations).toBe(1)
    })

    it('computes projections', () => {
      const from = new Date(Date.now() - 60000)
      const to = new Date(Date.now() + 60000)
      const summary = service.getSummary(from, to)

      expect(summary.projection.daily).toBeGreaterThan(0)
      expect(summary.projection.weekly).toBeGreaterThan(summary.projection.daily)
      expect(summary.projection.monthly).toBeGreaterThan(summary.projection.weekly)
    })
  })

  describe('Budgets', () => {
    it('adds and retrieves budgets', () => {
      service.addBudget({
        id: 'daily', name: 'Daily Budget', limitAmount: 1.0,
        period: 'daily', currentSpend: 0, alertThreshold: 0.8, enabled: true,
      })
      expect(service.getBudgets().length).toBe(1)
      expect(service.getBudget('daily')).toBeDefined()
    })

    it('removes budgets', () => {
      service.addBudget({
        id: 'daily', name: 'Daily', limitAmount: 1.0,
        period: 'daily', currentSpend: 0, alertThreshold: 0.8, enabled: true,
      })
      expect(service.removeBudget('daily')).toBe(true)
      expect(service.getBudgets().length).toBe(0)
    })

    it('computes budget spend', () => {
      service.addBudget({
        id: 'daily', name: 'Daily', limitAmount: 1.0,
        period: 'daily', currentSpend: 0, alertThreshold: 0.8, enabled: true,
      })
      service.record({ modelId: 'gpt-4', tokens: 100, cost: 0.5, operation: 'embed' })

      const spend = service.getBudgetSpend('daily')
      expect(spend).toBeCloseTo(0.5)
    })

    it('returns 0 for unknown budget', () => {
      expect(service.getBudgetSpend('unknown')).toBe(0)
    })
  })

  describe('Alerts', () => {
    it('triggers alert when budget threshold exceeded', () => {
      const alerts: any[] = []
      service.onAlert(a => alerts.push(a))

      service.addBudget({
        id: 'daily', name: 'Daily', limitAmount: 0.01,
        period: 'daily', currentSpend: 0, alertThreshold: 0.5, enabled: true,
      })

      service.record({ modelId: 'gpt-4', tokens: 100, cost: 0.01, operation: 'embed' })

      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].budgetId).toBe('daily')
      expect(alerts[0].percentage).toBeGreaterThanOrEqual(0.5)
    })

    it('stores alerts in history', () => {
      service.addBudget({
        id: 'daily', name: 'Daily', limitAmount: 0.001,
        period: 'daily', currentSpend: 0, alertThreshold: 0.1, enabled: true,
      })
      service.record({ modelId: 'gpt-4', tokens: 100, cost: 0.01, operation: 'embed' })

      expect(service.getAlerts().length).toBeGreaterThan(0)
    })
  })
})
