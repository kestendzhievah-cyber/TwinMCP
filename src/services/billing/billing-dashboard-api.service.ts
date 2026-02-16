/**
 * Billing Dashboard API Service.
 *
 * Provides data endpoints to feed the billing dashboard:
 *   - Revenue metrics (MRR, ARR, growth)
 *   - Invoice statistics (paid, pending, overdue)
 *   - Payment method breakdown
 *   - Subscription analytics
 *   - Period comparison
 *   - Top customers
 */

export interface RevenueMetrics {
  mrr: number
  arr: number
  mrrGrowthRate: number
  totalRevenue: number
  averageInvoiceValue: number
  revenueByMonth: Array<{ month: string; revenue: number }>
}

export interface InvoiceStats {
  total: number
  paid: number
  pending: number
  overdue: number
  draft: number
  canceled: number
  overdueAmount: number
  averageDaysToPayment: number
}

export interface PaymentMethodBreakdown {
  methods: Array<{ method: string; count: number; amount: number; percentage: number }>
  totalTransactions: number
  totalAmount: number
}

export interface SubscriptionAnalytics {
  totalActive: number
  totalTrialing: number
  totalCanceled: number
  totalPaused: number
  churnRate: number
  conversionRate: number
  planDistribution: Array<{ planName: string; count: number; revenue: number }>
}

export interface PeriodComparison {
  current: { revenue: number; invoices: number; newSubscriptions: number }
  previous: { revenue: number; invoices: number; newSubscriptions: number }
  changes: { revenue: number; invoices: number; newSubscriptions: number }
}

export interface TopCustomer {
  userId: string
  name: string
  totalSpent: number
  invoiceCount: number
  plan: string
  since: string
}

export interface DashboardData {
  revenue: RevenueMetrics
  invoices: InvoiceStats
  paymentMethods: PaymentMethodBreakdown
  subscriptions: SubscriptionAnalytics
  comparison: PeriodComparison
  topCustomers: TopCustomer[]
  generatedAt: string
}

// Input data types for feeding the service
export interface InvoiceRecord {
  id: string
  userId: string
  userName: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'draft' | 'canceled'
  paymentMethod?: string
  paidAt?: string
  createdAt: string
  plan?: string
}

export interface SubscriptionRecord {
  id: string
  userId: string
  planName: string
  planPrice: number
  status: 'active' | 'trialing' | 'canceled' | 'paused' | 'past_due'
  createdAt: string
  canceledAt?: string
}

export class BillingDashboardApiService {

  // ── Revenue Metrics ────────────────────────────────────────

  computeRevenueMetrics(invoices: InvoiceRecord[], months: number = 12): RevenueMetrics {
    const paid = invoices.filter(i => i.status === 'paid')
    const totalRevenue = paid.reduce((s, i) => s + i.amount, 0)
    const averageInvoiceValue = paid.length > 0 ? totalRevenue / paid.length : 0

    // Revenue by month
    const byMonth = new Map<string, number>()
    for (const inv of paid) {
      const month = (inv.paidAt || inv.createdAt).slice(0, 7)
      byMonth.set(month, (byMonth.get(month) || 0) + inv.amount)
    }
    const revenueByMonth = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-months)
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }))

    // MRR from last month
    const lastMonth = revenueByMonth.length > 0 ? revenueByMonth[revenueByMonth.length - 1].revenue : 0
    const prevMonth = revenueByMonth.length > 1 ? revenueByMonth[revenueByMonth.length - 2].revenue : 0
    const mrrGrowthRate = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0

    return {
      mrr: Math.round(lastMonth * 100) / 100,
      arr: Math.round(lastMonth * 12 * 100) / 100,
      mrrGrowthRate: Math.round(mrrGrowthRate * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageInvoiceValue: Math.round(averageInvoiceValue * 100) / 100,
      revenueByMonth,
    }
  }

  // ── Invoice Statistics ─────────────────────────────────────

  computeInvoiceStats(invoices: InvoiceRecord[]): InvoiceStats {
    const paid = invoices.filter(i => i.status === 'paid')
    const pending = invoices.filter(i => i.status === 'pending')
    const overdue = invoices.filter(i => i.status === 'overdue')
    const draft = invoices.filter(i => i.status === 'draft')
    const canceled = invoices.filter(i => i.status === 'canceled')

    const overdueAmount = overdue.reduce((s, i) => s + i.amount, 0)

    // Average days to payment
    const paymentDays = paid
      .filter(i => i.paidAt)
      .map(i => (new Date(i.paidAt!).getTime() - new Date(i.createdAt).getTime()) / 86400000)
    const averageDaysToPayment = paymentDays.length > 0
      ? paymentDays.reduce((s, d) => s + d, 0) / paymentDays.length
      : 0

    return {
      total: invoices.length,
      paid: paid.length,
      pending: pending.length,
      overdue: overdue.length,
      draft: draft.length,
      canceled: canceled.length,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      averageDaysToPayment: Math.round(averageDaysToPayment * 10) / 10,
    }
  }

  // ── Payment Method Breakdown ───────────────────────────────

  computePaymentMethodBreakdown(invoices: InvoiceRecord[]): PaymentMethodBreakdown {
    const paid = invoices.filter(i => i.status === 'paid' && i.paymentMethod)
    const byMethod = new Map<string, { count: number; amount: number }>()

    for (const inv of paid) {
      const method = inv.paymentMethod || 'unknown'
      const entry = byMethod.get(method) || { count: 0, amount: 0 }
      entry.count++
      entry.amount += inv.amount
      byMethod.set(method, entry)
    }

    const totalTransactions = paid.length
    const totalAmount = paid.reduce((s, i) => s + i.amount, 0)

    const methods = Array.from(byMethod.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: Math.round(data.amount * 100) / 100,
      percentage: totalTransactions > 0 ? Math.round((data.count / totalTransactions) * 10000) / 100 : 0,
    })).sort((a, b) => b.amount - a.amount)

    return { methods, totalTransactions, totalAmount: Math.round(totalAmount * 100) / 100 }
  }

  // ── Subscription Analytics ─────────────────────────────────

  computeSubscriptionAnalytics(subscriptions: SubscriptionRecord[]): SubscriptionAnalytics {
    const active = subscriptions.filter(s => s.status === 'active')
    const trialing = subscriptions.filter(s => s.status === 'trialing')
    const canceled = subscriptions.filter(s => s.status === 'canceled')
    const paused = subscriptions.filter(s => s.status === 'paused')

    const total = subscriptions.length
    const churnRate = total > 0 ? (canceled.length / total) * 100 : 0
    const conversionRate = trialing.length > 0
      ? (active.filter(a => subscriptions.some(s => s.userId === a.userId && s.status === 'trialing')).length / trialing.length) * 100
      : 0

    // Plan distribution
    const byPlan = new Map<string, { count: number; revenue: number }>()
    for (const sub of active) {
      const entry = byPlan.get(sub.planName) || { count: 0, revenue: 0 }
      entry.count++
      entry.revenue += sub.planPrice
      byPlan.set(sub.planName, entry)
    }

    const planDistribution = Array.from(byPlan.entries()).map(([planName, data]) => ({
      planName, count: data.count, revenue: Math.round(data.revenue * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue)

    return {
      totalActive: active.length,
      totalTrialing: trialing.length,
      totalCanceled: canceled.length,
      totalPaused: paused.length,
      churnRate: Math.round(churnRate * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      planDistribution,
    }
  }

  // ── Period Comparison ──────────────────────────────────────

  computePeriodComparison(invoices: InvoiceRecord[], subscriptions: SubscriptionRecord[], currentFrom: string, currentTo: string, previousFrom: string, previousTo: string): PeriodComparison {
    const currentInvoices = invoices.filter(i => i.createdAt >= currentFrom && i.createdAt <= currentTo)
    const previousInvoices = invoices.filter(i => i.createdAt >= previousFrom && i.createdAt <= previousTo)

    const currentSubs = subscriptions.filter(s => s.createdAt >= currentFrom && s.createdAt <= currentTo)
    const previousSubs = subscriptions.filter(s => s.createdAt >= previousFrom && s.createdAt <= previousTo)

    const currentRevenue = currentInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const previousRevenue = previousInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)

    return {
      current: { revenue: Math.round(currentRevenue * 100) / 100, invoices: currentInvoices.length, newSubscriptions: currentSubs.length },
      previous: { revenue: Math.round(previousRevenue * 100) / 100, invoices: previousInvoices.length, newSubscriptions: previousSubs.length },
      changes: {
        revenue: previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 10000) / 100 : 0,
        invoices: previousInvoices.length > 0 ? Math.round(((currentInvoices.length - previousInvoices.length) / previousInvoices.length) * 10000) / 100 : 0,
        newSubscriptions: previousSubs.length > 0 ? Math.round(((currentSubs.length - previousSubs.length) / previousSubs.length) * 10000) / 100 : 0,
      },
    }
  }

  // ── Top Customers ──────────────────────────────────────────

  computeTopCustomers(invoices: InvoiceRecord[], limit: number = 10): TopCustomer[] {
    const byUser = new Map<string, { name: string; totalSpent: number; invoiceCount: number; plan: string; since: string }>()

    for (const inv of invoices.filter(i => i.status === 'paid')) {
      const entry = byUser.get(inv.userId) || { name: inv.userName, totalSpent: 0, invoiceCount: 0, plan: inv.plan || 'unknown', since: inv.createdAt }
      entry.totalSpent += inv.amount
      entry.invoiceCount++
      if (inv.createdAt < entry.since) entry.since = inv.createdAt
      byUser.set(inv.userId, entry)
    }

    return Array.from(byUser.entries())
      .map(([userId, data]) => ({ userId, ...data, totalSpent: Math.round(data.totalSpent * 100) / 100 }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit)
  }

  // ── Full Dashboard ─────────────────────────────────────────

  generateDashboard(invoices: InvoiceRecord[], subscriptions: SubscriptionRecord[], currentFrom: string, currentTo: string, previousFrom: string, previousTo: string): DashboardData {
    return {
      revenue: this.computeRevenueMetrics(invoices),
      invoices: this.computeInvoiceStats(invoices),
      paymentMethods: this.computePaymentMethodBreakdown(invoices),
      subscriptions: this.computeSubscriptionAnalytics(subscriptions),
      comparison: this.computePeriodComparison(invoices, subscriptions, currentFrom, currentTo, previousFrom, previousTo),
      topCustomers: this.computeTopCustomers(invoices),
      generatedAt: new Date().toISOString(),
    }
  }
}

export const billingDashboardApiService = new BillingDashboardApiService()
