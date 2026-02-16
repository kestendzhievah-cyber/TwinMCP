import { BusinessIntelligenceService } from '../../src/services/analytics/business-intelligence.service'

describe('BusinessIntelligenceService', () => {
  let service: BusinessIntelligenceService

  beforeEach(() => {
    service = new BusinessIntelligenceService()
    service.addCustomer({ userId: 'u1', signupDate: '2024-01-01T00:00:00Z', lastActiveDate: new Date().toISOString(), totalRevenue: 1200, monthlyRevenue: 100, activityScore: 0.8, plan: 'pro' })
    service.addCustomer({ userId: 'u2', signupDate: '2024-06-01T00:00:00Z', lastActiveDate: '2024-10-01T00:00:00Z', totalRevenue: 300, monthlyRevenue: 50, activityScore: 0.1, plan: 'starter' })
    service.addCustomer({ userId: 'u3', signupDate: '2025-01-01T00:00:00Z', lastActiveDate: new Date().toISOString(), totalRevenue: 6000, monthlyRevenue: 500, activityScore: 0.9, plan: 'enterprise' })
    service.addCustomer({ userId: 'u4', signupDate: '2024-03-01T00:00:00Z', lastActiveDate: '2024-04-01T00:00:00Z', totalRevenue: 0, monthlyRevenue: 0, activityScore: 0, plan: 'free' })
  })

  describe('Customer management', () => {
    it('adds and retrieves customers', () => {
      expect(service.customerCount).toBe(4)
      expect(service.getCustomer('u1')?.plan).toBe('pro')
    })

    it('lists all customers', () => {
      expect(service.getCustomers().length).toBe(4)
    })

    it('removes a customer', () => {
      expect(service.removeCustomer('u4')).toBe(true)
      expect(service.customerCount).toBe(3)
    })
  })

  describe('Churn prediction', () => {
    it('predicts low churn for active user', () => {
      const pred = service.predictChurn('u1')!
      expect(pred.riskLevel).toBe('low')
      expect(pred.churnProbability).toBeLessThan(0.3)
    })

    it('predicts high churn for inactive user', () => {
      const pred = service.predictChurn('u2')!
      expect(['high', 'critical']).toContain(pred.riskLevel)
      expect(pred.factors.length).toBeGreaterThan(0)
    })

    it('predicts critical churn for zero-activity user', () => {
      const pred = service.predictChurn('u4')!
      expect(pred.riskLevel).toBe('critical')
      expect(pred.recommendedAction).toContain('Immediate')
    })

    it('returns null for unknown user', () => {
      expect(service.predictChurn('unknown')).toBeNull()
    })

    it('predicts churn for all users sorted by probability', () => {
      const all = service.predictChurnAll()
      expect(all.length).toBe(4)
      expect(all[0].churnProbability).toBeGreaterThanOrEqual(all[1].churnProbability)
    })

    it('includes recommended actions', () => {
      const pred = service.predictChurn('u1')!
      expect(pred.recommendedAction).toBeDefined()
    })
  })

  describe('LTV calculation', () => {
    it('calculates LTV for a customer', () => {
      const ltv = service.calculateLTV('u1')!
      expect(ltv.currentLTV).toBe(1200)
      expect(ltv.predictedLTV).toBeGreaterThan(0)
      expect(ltv.avgMonthlyRevenue).toBeGreaterThan(0)
      expect(ltv.customerAge).toBeGreaterThan(0)
    })

    it('returns null for unknown user', () => {
      expect(service.calculateLTV('unknown')).toBeNull()
    })

    it('calculates LTV for all users sorted by predicted LTV', () => {
      const all = service.calculateLTVAll()
      expect(all.length).toBe(4)
      expect(all[0].predictedLTV).toBeGreaterThanOrEqual(all[1].predictedLTV)
    })

    it('uses custom churn rate', () => {
      const ltv1 = service.calculateLTV('u1', 0.05)!
      const ltv2 = service.calculateLTV('u1', 0.1)!
      expect(ltv1.expectedLifetimeMonths).toBeGreaterThan(ltv2.expectedLifetimeMonths)
    })
  })

  describe('Growth metrics', () => {
    it('calculates MRR and ARR', () => {
      const metrics = service.calculateGrowthMetrics()
      expect(metrics.mrr).toBe(650) // 100 + 50 + 500 + 0
      expect(metrics.arr).toBe(7800)
      expect(metrics.customerCount).toBe(4)
    })

    it('calculates ARPU', () => {
      const metrics = service.calculateGrowthMetrics()
      expect(metrics.arpu).toBeCloseTo(162.5)
    })

    it('calculates growth rate', () => {
      const metrics = service.calculateGrowthMetrics(600, 50, 20, 10, 5)
      expect(metrics.mrrGrowthRate).toBeGreaterThan(0)
      expect(metrics.netRevenueRetention).toBeGreaterThan(0)
    })

    it('calculates gross churn rate', () => {
      const metrics = service.calculateGrowthMetrics(1000, 0, 0, 0, 100)
      expect(metrics.grossChurnRate).toBe(10)
    })
  })

  describe('Customer segmentation', () => {
    it('segments customers', () => {
      const segments = service.segmentCustomers()
      expect(segments.length).toBeGreaterThan(0)
      const names = segments.map(s => s.name)
      expect(names).toContain('Enterprise')
      expect(names).toContain('Free')
    })

    it('includes segment metrics', () => {
      const segments = service.segmentCustomers()
      for (const seg of segments) {
        expect(seg.count).toBeGreaterThan(0)
        expect(seg.userIds.length).toBe(seg.count)
      }
    })
  })

  describe('Revenue forecasting', () => {
    it('forecasts revenue', () => {
      const forecasts = service.forecastRevenue(6, 0.05)
      expect(forecasts.length).toBe(6)
      expect(forecasts[0].predictedMRR).toBeGreaterThan(0)
      expect(forecasts[0].confidence).toBeGreaterThan(0)
    })

    it('shows increasing MRR with positive growth', () => {
      const forecasts = service.forecastRevenue(3, 0.1)
      expect(forecasts[2].predictedMRR).toBeGreaterThan(forecasts[0].predictedMRR)
    })

    it('includes confidence bounds', () => {
      const forecasts = service.forecastRevenue(3)
      for (const f of forecasts) {
        expect(f.lowerBound).toBeLessThan(f.predictedMRR)
        expect(f.upperBound).toBeGreaterThan(f.predictedMRR)
      }
    })

    it('decreases confidence over time', () => {
      const forecasts = service.forecastRevenue(6)
      expect(forecasts[5].confidence).toBeLessThan(forecasts[0].confidence)
    })
  })
})
