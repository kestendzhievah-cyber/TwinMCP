/**
 * Business Intelligence Service.
 *
 * Advanced business metrics and predictions:
 *   - Churn prediction (based on activity decay)
 *   - Customer Lifetime Value (LTV) calculation
 *   - Growth metrics (MRR, ARR, net revenue retention)
 *   - Customer segmentation
 *   - Revenue forecasting
 */

export interface CustomerProfile {
  userId: string
  signupDate: string
  lastActiveDate: string
  totalRevenue: number
  monthlyRevenue: number
  activityScore: number // 0-1
  plan: string
  segment?: string
}

export interface ChurnPrediction {
  userId: string
  churnProbability: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
  daysSinceLastActive: number
  recommendedAction: string
}

export interface LTVResult {
  userId: string
  currentLTV: number
  predictedLTV: number
  avgMonthlyRevenue: number
  customerAge: number // months
  expectedLifetimeMonths: number
}

export interface GrowthMetrics {
  mrr: number
  arr: number
  mrrGrowthRate: number
  netRevenueRetention: number
  grossChurnRate: number
  newMRR: number
  expansionMRR: number
  contractionMRR: number
  churnedMRR: number
  customerCount: number
  arpu: number
}

export interface CustomerSegment {
  name: string
  criteria: string
  count: number
  avgRevenue: number
  avgLTV: number
  churnRate: number
  userIds: string[]
}

export interface RevenueForecast {
  month: string
  predictedMRR: number
  confidence: number
  lowerBound: number
  upperBound: number
}

export class BusinessIntelligenceService {
  private customers: Map<string, CustomerProfile> = new Map()

  // ── Customer Management ────────────────────────────────────

  addCustomer(profile: CustomerProfile): void {
    this.customers.set(profile.userId, profile)
  }

  getCustomer(userId: string): CustomerProfile | undefined {
    return this.customers.get(userId)
  }

  getCustomers(): CustomerProfile[] {
    return Array.from(this.customers.values())
  }

  removeCustomer(userId: string): boolean {
    return this.customers.delete(userId)
  }

  get customerCount(): number { return this.customers.size }

  // ── Churn Prediction ───────────────────────────────────────

  predictChurn(userId: string): ChurnPrediction | null {
    const customer = this.customers.get(userId)
    if (!customer) return null

    const daysSinceActive = Math.floor((Date.now() - new Date(customer.lastActiveDate).getTime()) / 86400000)
    const factors: string[] = []

    // Activity decay factor
    let probability = 0
    if (daysSinceActive > 90) { probability += 0.4; factors.push('Inactive for 90+ days') }
    else if (daysSinceActive > 60) { probability += 0.25; factors.push('Inactive for 60+ days') }
    else if (daysSinceActive > 30) { probability += 0.15; factors.push('Inactive for 30+ days') }

    // Activity score factor
    if (customer.activityScore < 0.2) { probability += 0.3; factors.push('Very low activity score') }
    else if (customer.activityScore < 0.5) { probability += 0.15; factors.push('Below average activity') }

    // Revenue trend factor
    if (customer.monthlyRevenue === 0) { probability += 0.2; factors.push('No recent revenue') }

    probability = Math.min(probability, 1)

    const riskLevel: ChurnPrediction['riskLevel'] =
      probability >= 0.7 ? 'critical' :
      probability >= 0.5 ? 'high' :
      probability >= 0.3 ? 'medium' : 'low'

    const recommendedAction =
      riskLevel === 'critical' ? 'Immediate outreach required — offer retention incentive' :
      riskLevel === 'high' ? 'Schedule check-in call and review account health' :
      riskLevel === 'medium' ? 'Send re-engagement email campaign' :
      'No action needed — customer is healthy'

    return { userId, churnProbability: Math.round(probability * 100) / 100, riskLevel, factors, daysSinceLastActive: daysSinceActive, recommendedAction }
  }

  predictChurnAll(): ChurnPrediction[] {
    return Array.from(this.customers.keys())
      .map(id => this.predictChurn(id)!)
      .filter(Boolean)
      .sort((a, b) => b.churnProbability - a.churnProbability)
  }

  // ── LTV Calculation ────────────────────────────────────────

  calculateLTV(userId: string, avgChurnRateMonthly: number = 0.05): LTVResult | null {
    const customer = this.customers.get(userId)
    if (!customer) return null

    const customerAgeMs = Date.now() - new Date(customer.signupDate).getTime()
    const customerAgeMonths = Math.max(1, Math.floor(customerAgeMs / (30 * 86400000)))
    const avgMonthlyRevenue = customer.totalRevenue / customerAgeMonths
    const expectedLifetimeMonths = avgChurnRateMonthly > 0 ? 1 / avgChurnRateMonthly : 120

    return {
      userId,
      currentLTV: customer.totalRevenue,
      predictedLTV: Math.round(avgMonthlyRevenue * expectedLifetimeMonths * 100) / 100,
      avgMonthlyRevenue: Math.round(avgMonthlyRevenue * 100) / 100,
      customerAge: customerAgeMonths,
      expectedLifetimeMonths: Math.round(expectedLifetimeMonths),
    }
  }

  calculateLTVAll(avgChurnRate?: number): LTVResult[] {
    return Array.from(this.customers.keys())
      .map(id => this.calculateLTV(id, avgChurnRate)!)
      .filter(Boolean)
      .sort((a, b) => b.predictedLTV - a.predictedLTV)
  }

  // ── Growth Metrics ─────────────────────────────────────────

  calculateGrowthMetrics(previousMRR: number = 0, newMRR: number = 0, expansionMRR: number = 0, contractionMRR: number = 0, churnedMRR: number = 0): GrowthMetrics {
    const customers = this.getCustomers()
    const mrr = customers.reduce((sum, c) => sum + c.monthlyRevenue, 0)
    const arr = mrr * 12
    const customerCount = customers.length
    const arpu = customerCount > 0 ? mrr / customerCount : 0

    const mrrGrowthRate = previousMRR > 0 ? ((mrr - previousMRR) / previousMRR) * 100 : 0
    const netRevenueRetention = previousMRR > 0
      ? ((previousMRR + expansionMRR - contractionMRR - churnedMRR) / previousMRR) * 100
      : 100
    const grossChurnRate = previousMRR > 0 ? (churnedMRR / previousMRR) * 100 : 0

    return {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      mrrGrowthRate: Math.round(mrrGrowthRate * 100) / 100,
      netRevenueRetention: Math.round(netRevenueRetention * 100) / 100,
      grossChurnRate: Math.round(grossChurnRate * 100) / 100,
      newMRR, expansionMRR, contractionMRR, churnedMRR,
      customerCount,
      arpu: Math.round(arpu * 100) / 100,
    }
  }

  // ── Customer Segmentation ──────────────────────────────────

  segmentCustomers(): CustomerSegment[] {
    const customers = this.getCustomers()
    const segments: Map<string, CustomerProfile[]> = new Map()

    for (const c of customers) {
      let segName: string
      if (c.monthlyRevenue >= 500) segName = 'Enterprise'
      else if (c.monthlyRevenue >= 100) segName = 'Professional'
      else if (c.monthlyRevenue > 0) segName = 'Starter'
      else segName = 'Free'

      if (!segments.has(segName)) segments.set(segName, [])
      segments.get(segName)!.push(c)
    }

    return Array.from(segments.entries()).map(([name, users]) => {
      const avgRevenue = users.reduce((s, u) => s + u.monthlyRevenue, 0) / users.length
      const ltvs = users.map(u => this.calculateLTV(u.userId)!).filter(Boolean)
      const avgLTV = ltvs.length > 0 ? ltvs.reduce((s, l) => s + l.predictedLTV, 0) / ltvs.length : 0
      const churns = users.map(u => this.predictChurn(u.userId)!).filter(Boolean)
      const churnRate = churns.length > 0 ? churns.reduce((s, c) => s + c.churnProbability, 0) / churns.length : 0

      return {
        name,
        criteria: `Monthly revenue segment`,
        count: users.length,
        avgRevenue: Math.round(avgRevenue * 100) / 100,
        avgLTV: Math.round(avgLTV * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        userIds: users.map(u => u.userId),
      }
    })
  }

  // ── Revenue Forecasting ────────────────────────────────────

  forecastRevenue(months: number = 6, growthRate: number = 0.05): RevenueForecast[] {
    const customers = this.getCustomers()
    let currentMRR = customers.reduce((s, c) => s + c.monthlyRevenue, 0)
    const forecasts: RevenueForecast[] = []

    for (let i = 1; i <= months; i++) {
      const predicted = currentMRR * (1 + growthRate)
      const variance = predicted * 0.1
      const d = new Date()
      d.setMonth(d.getMonth() + i)

      forecasts.push({
        month: d.toISOString().slice(0, 7),
        predictedMRR: Math.round(predicted * 100) / 100,
        confidence: Math.max(0.5, 1 - i * 0.05),
        lowerBound: Math.round((predicted - variance) * 100) / 100,
        upperBound: Math.round((predicted + variance) * 100) / 100,
      })

      currentMRR = predicted
    }

    return forecasts
  }
}

export const businessIntelligenceService = new BusinessIntelligenceService()
