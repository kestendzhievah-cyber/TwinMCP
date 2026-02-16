import { BillingDashboardApiService } from '../../src/services/billing/billing-dashboard-api.service'
import type { InvoiceRecord, SubscriptionRecord } from '../../src/services/billing/billing-dashboard-api.service'

describe('BillingDashboardApiService', () => {
  let service: BillingDashboardApiService
  let invoices: InvoiceRecord[]
  let subscriptions: SubscriptionRecord[]

  beforeEach(() => {
    service = new BillingDashboardApiService()
    invoices = [
      { id: 'i1', userId: 'u1', userName: 'Alice', amount: 99, status: 'paid', paymentMethod: 'card', paidAt: '2025-01-05T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', plan: 'Pro' },
      { id: 'i2', userId: 'u2', userName: 'Bob', amount: 299, status: 'paid', paymentMethod: 'card', paidAt: '2025-01-10T00:00:00Z', createdAt: '2025-01-02T00:00:00Z', plan: 'Enterprise' },
      { id: 'i3', userId: 'u3', userName: 'Charlie', amount: 29, status: 'pending', createdAt: '2025-01-15T00:00:00Z', plan: 'Starter' },
      { id: 'i4', userId: 'u1', userName: 'Alice', amount: 99, status: 'paid', paymentMethod: 'paypal', paidAt: '2025-02-05T00:00:00Z', createdAt: '2025-02-01T00:00:00Z', plan: 'Pro' },
      { id: 'i5', userId: 'u4', userName: 'Diana', amount: 50, status: 'overdue', createdAt: '2024-12-01T00:00:00Z', plan: 'Starter' },
      { id: 'i6', userId: 'u5', userName: 'Eve', amount: 0, status: 'draft', createdAt: '2025-02-10T00:00:00Z' },
    ]
    subscriptions = [
      { id: 's1', userId: 'u1', planName: 'Pro', planPrice: 99, status: 'active', createdAt: '2025-01-01T00:00:00Z' },
      { id: 's2', userId: 'u2', planName: 'Enterprise', planPrice: 299, status: 'active', createdAt: '2025-01-02T00:00:00Z' },
      { id: 's3', userId: 'u3', planName: 'Starter', planPrice: 29, status: 'trialing', createdAt: '2025-01-15T00:00:00Z' },
      { id: 's4', userId: 'u4', planName: 'Starter', planPrice: 29, status: 'canceled', createdAt: '2024-11-01T00:00:00Z', canceledAt: '2024-12-15T00:00:00Z' },
      { id: 's5', userId: 'u5', planName: 'Pro', planPrice: 99, status: 'paused', createdAt: '2024-12-01T00:00:00Z' },
    ]
  })

  describe('Revenue metrics', () => {
    it('computes total revenue', () => {
      const metrics = service.computeRevenueMetrics(invoices)
      expect(metrics.totalRevenue).toBe(497) // 99 + 299 + 99
    })

    it('computes average invoice value', () => {
      const metrics = service.computeRevenueMetrics(invoices)
      expect(metrics.averageInvoiceValue).toBeCloseTo(165.67, 1)
    })

    it('computes revenue by month', () => {
      const metrics = service.computeRevenueMetrics(invoices)
      expect(metrics.revenueByMonth.length).toBeGreaterThan(0)
    })

    it('computes MRR from last month', () => {
      const metrics = service.computeRevenueMetrics(invoices)
      expect(metrics.mrr).toBeGreaterThan(0)
      expect(metrics.arr).toBe(metrics.mrr * 12)
    })
  })

  describe('Invoice stats', () => {
    it('counts by status', () => {
      const stats = service.computeInvoiceStats(invoices)
      expect(stats.total).toBe(6)
      expect(stats.paid).toBe(3)
      expect(stats.pending).toBe(1)
      expect(stats.overdue).toBe(1)
      expect(stats.draft).toBe(1)
    })

    it('computes overdue amount', () => {
      const stats = service.computeInvoiceStats(invoices)
      expect(stats.overdueAmount).toBe(50)
    })

    it('computes average days to payment', () => {
      const stats = service.computeInvoiceStats(invoices)
      expect(stats.averageDaysToPayment).toBeGreaterThan(0)
    })
  })

  describe('Payment method breakdown', () => {
    it('breaks down by method', () => {
      const breakdown = service.computePaymentMethodBreakdown(invoices)
      expect(breakdown.methods.length).toBe(2) // card, paypal
      expect(breakdown.totalTransactions).toBe(3)
    })

    it('computes percentages', () => {
      const breakdown = service.computePaymentMethodBreakdown(invoices)
      const total = breakdown.methods.reduce((s, m) => s + m.percentage, 0)
      expect(total).toBeCloseTo(100, 0)
    })
  })

  describe('Subscription analytics', () => {
    it('counts by status', () => {
      const analytics = service.computeSubscriptionAnalytics(subscriptions)
      expect(analytics.totalActive).toBe(2)
      expect(analytics.totalTrialing).toBe(1)
      expect(analytics.totalCanceled).toBe(1)
      expect(analytics.totalPaused).toBe(1)
    })

    it('computes churn rate', () => {
      const analytics = service.computeSubscriptionAnalytics(subscriptions)
      expect(analytics.churnRate).toBe(20) // 1/5
    })

    it('computes plan distribution', () => {
      const analytics = service.computeSubscriptionAnalytics(subscriptions)
      expect(analytics.planDistribution.length).toBeGreaterThan(0)
      expect(analytics.planDistribution[0].revenue).toBeGreaterThan(0)
    })
  })

  describe('Period comparison', () => {
    it('compares two periods', () => {
      const comparison = service.computePeriodComparison(
        invoices, subscriptions,
        '2025-01-01', '2025-01-31', '2024-12-01', '2024-12-31'
      )
      expect(comparison.current.invoices).toBeGreaterThan(0)
      expect(comparison.current.revenue).toBeGreaterThan(0)
    })

    it('computes change percentages', () => {
      const comparison = service.computePeriodComparison(
        invoices, subscriptions,
        '2025-01-01', '2025-01-31', '2024-12-01', '2024-12-31'
      )
      expect(typeof comparison.changes.revenue).toBe('number')
    })
  })

  describe('Top customers', () => {
    it('ranks customers by spend', () => {
      const top = service.computeTopCustomers(invoices)
      expect(top.length).toBeGreaterThan(0)
      expect(top[0].totalSpent).toBeGreaterThanOrEqual(top[top.length - 1].totalSpent)
    })

    it('respects limit', () => {
      const top = service.computeTopCustomers(invoices, 2)
      expect(top.length).toBeLessThanOrEqual(2)
    })

    it('includes customer details', () => {
      const top = service.computeTopCustomers(invoices)
      expect(top[0].name).toBeDefined()
      expect(top[0].invoiceCount).toBeGreaterThan(0)
    })
  })

  describe('Full dashboard', () => {
    it('generates complete dashboard data', () => {
      const dashboard = service.generateDashboard(
        invoices, subscriptions,
        '2025-01-01', '2025-01-31', '2024-12-01', '2024-12-31'
      )
      expect(dashboard.revenue).toBeDefined()
      expect(dashboard.invoices).toBeDefined()
      expect(dashboard.paymentMethods).toBeDefined()
      expect(dashboard.subscriptions).toBeDefined()
      expect(dashboard.comparison).toBeDefined()
      expect(dashboard.topCustomers).toBeDefined()
      expect(dashboard.generatedAt).toBeDefined()
    })
  })
})
