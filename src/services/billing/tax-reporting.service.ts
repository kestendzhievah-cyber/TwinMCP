/**
 * Tax Reporting & TaxJar Service.
 *
 * Automated tax reports and US sales tax via TaxJar:
 *   - Tax report generation (monthly, quarterly, yearly)
 *   - TaxJar API integration for US nexus/rates
 *   - Tax summary by jurisdiction
 *   - Filing-ready export (CSV)
 *   - Tax liability tracking
 *   - Audit trail
 */

export interface TaxTransaction {
  id: string
  invoiceId: string
  customerId: string
  amount: number
  taxAmount: number
  taxRate: number
  jurisdiction: string
  country: string
  state?: string
  city?: string
  taxType: 'vat' | 'sales_tax' | 'gst' | 'none'
  reverseCharge: boolean
  date: string
}

export interface TaxReport {
  id: string
  name: string
  period: { from: string; to: string }
  type: 'monthly' | 'quarterly' | 'yearly'
  generatedAt: string
  totalRevenue: number
  totalTaxCollected: number
  totalTaxLiability: number
  byJurisdiction: JurisdictionSummary[]
  byTaxType: Array<{ type: string; amount: number; count: number }>
  transactionCount: number
}

export interface JurisdictionSummary {
  jurisdiction: string
  country: string
  state?: string
  revenue: number
  taxCollected: number
  taxRate: number
  transactionCount: number
}

export interface TaxJarConfig {
  apiKey: string
  sandbox: boolean
  nexusStates: string[]
  fromAddress: { street: string; city: string; state: string; zip: string; country: string }
}

export interface TaxJarRate {
  state: string
  stateRate: number
  countyRate: number
  cityRate: number
  combinedRate: number
  freightTaxable: boolean
}

export interface TaxFilingExport {
  format: 'csv' | 'json'
  content: string
  period: string
  jurisdiction: string
  generatedAt: string
}

export class TaxReportingService {
  private transactions: TaxTransaction[] = []
  private reports: Map<string, TaxReport> = new Map()
  private taxJarConfig: TaxJarConfig | null = null
  private taxJarRatesCache: Map<string, { rate: TaxJarRate; cachedAt: number }> = new Map()
  private idCounter = 0

  // ── Transaction Tracking ───────────────────────────────────

  recordTransaction(tx: Omit<TaxTransaction, 'id'>): TaxTransaction {
    const transaction: TaxTransaction = { id: `tx-${++this.idCounter}`, ...tx }
    this.transactions.push(transaction)
    return transaction
  }

  getTransactions(from?: string, to?: string): TaxTransaction[] {
    let txs = [...this.transactions]
    if (from) txs = txs.filter(t => t.date >= from)
    if (to) txs = txs.filter(t => t.date <= to)
    return txs
  }

  get transactionCount(): number { return this.transactions.length }

  // ── Report Generation ──────────────────────────────────────

  generateReport(name: string, from: string, to: string, type: TaxReport['type'] = 'monthly'): TaxReport {
    const txs = this.getTransactions(from, to)

    const totalRevenue = txs.reduce((s, t) => s + t.amount, 0)
    const totalTaxCollected = txs.reduce((s, t) => s + t.taxAmount, 0)
    const totalTaxLiability = txs.filter(t => !t.reverseCharge).reduce((s, t) => s + t.taxAmount, 0)

    // By jurisdiction
    const jurisdictionMap = new Map<string, { revenue: number; taxCollected: number; rates: number[]; count: number; country: string; state?: string }>()
    for (const tx of txs) {
      const key = tx.jurisdiction
      const entry = jurisdictionMap.get(key) || { revenue: 0, taxCollected: 0, rates: [], count: 0, country: tx.country, state: tx.state }
      entry.revenue += tx.amount
      entry.taxCollected += tx.taxAmount
      entry.rates.push(tx.taxRate)
      entry.count++
      jurisdictionMap.set(key, entry)
    }

    const byJurisdiction: JurisdictionSummary[] = Array.from(jurisdictionMap.entries()).map(([jurisdiction, data]) => ({
      jurisdiction, country: data.country, state: data.state,
      revenue: Math.round(data.revenue * 100) / 100,
      taxCollected: Math.round(data.taxCollected * 100) / 100,
      taxRate: data.rates.length > 0 ? Math.round((data.rates.reduce((s, r) => s + r, 0) / data.rates.length) * 10000) / 10000 : 0,
      transactionCount: data.count,
    })).sort((a, b) => b.taxCollected - a.taxCollected)

    // By tax type
    const typeMap = new Map<string, { amount: number; count: number }>()
    for (const tx of txs) {
      const entry = typeMap.get(tx.taxType) || { amount: 0, count: 0 }
      entry.amount += tx.taxAmount
      entry.count++
      typeMap.set(tx.taxType, entry)
    }
    const byTaxType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type, amount: Math.round(data.amount * 100) / 100, count: data.count,
    }))

    const report: TaxReport = {
      id: `report-${++this.idCounter}`,
      name, period: { from, to }, type, generatedAt: new Date().toISOString(),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTaxCollected: Math.round(totalTaxCollected * 100) / 100,
      totalTaxLiability: Math.round(totalTaxLiability * 100) / 100,
      byJurisdiction, byTaxType, transactionCount: txs.length,
    }

    this.reports.set(report.id, report)
    return report
  }

  getReport(id: string): TaxReport | undefined {
    return this.reports.get(id)
  }

  getReports(): TaxReport[] {
    return Array.from(this.reports.values()).sort((a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )
  }

  // ── Filing Export ──────────────────────────────────────────

  exportForFiling(reportId: string, format: 'csv' | 'json' = 'csv'): TaxFilingExport | null {
    const report = this.reports.get(reportId)
    if (!report) return null

    let content: string
    if (format === 'csv') {
      const lines = ['Jurisdiction,Country,State,Revenue,Tax Collected,Tax Rate,Transactions']
      for (const j of report.byJurisdiction) {
        lines.push(`${j.jurisdiction},${j.country},${j.state || ''},${j.revenue},${j.taxCollected},${j.taxRate},${j.transactionCount}`)
      }
      lines.push('')
      lines.push(`Total,,,$${report.totalRevenue},$${report.totalTaxCollected},,${report.transactionCount}`)
      content = lines.join('\n')
    } else {
      content = JSON.stringify({
        period: report.period,
        totalRevenue: report.totalRevenue,
        totalTaxCollected: report.totalTaxCollected,
        totalTaxLiability: report.totalTaxLiability,
        jurisdictions: report.byJurisdiction,
      }, null, 2)
    }

    return {
      format, content,
      period: `${report.period.from} to ${report.period.to}`,
      jurisdiction: 'all',
      generatedAt: new Date().toISOString(),
    }
  }

  // ── TaxJar Integration (US Sales Tax) ──────────────────────

  configureTaxJar(config: TaxJarConfig): void {
    this.taxJarConfig = config
  }

  getTaxJarConfig(): TaxJarConfig | null {
    return this.taxJarConfig
  }

  isTaxJarConfigured(): boolean {
    return this.taxJarConfig !== null && !!this.taxJarConfig.apiKey
  }

  /** Look up US sales tax rate for a zip code (simulated). */
  lookupUSRate(zip: string, state: string): TaxJarRate {
    const cacheKey = `${state}-${zip}`
    const cached = this.taxJarRatesCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < 3600000) return cached.rate

    // Simulated rate lookup based on state
    const stateRates: Record<string, number> = {
      'CA': 0.0725, 'NY': 0.08, 'TX': 0.0625, 'FL': 0.06, 'WA': 0.065,
      'IL': 0.0625, 'PA': 0.06, 'OH': 0.0575, 'GA': 0.04, 'NC': 0.0475,
      'NJ': 0.06625, 'VA': 0.053, 'MA': 0.0625, 'AZ': 0.056, 'CO': 0.029,
      'OR': 0, 'MT': 0, 'NH': 0, 'DE': 0, 'AK': 0,
    }

    const stateRate = stateRates[state] ?? 0.05
    const countyRate = stateRate > 0 ? 0.01 : 0
    const cityRate = stateRate > 0 ? 0.005 : 0

    const rate: TaxJarRate = {
      state, stateRate, countyRate, cityRate,
      combinedRate: Math.round((stateRate + countyRate + cityRate) * 10000) / 10000,
      freightTaxable: ['CA', 'NY', 'TX', 'FL'].includes(state),
    }

    this.taxJarRatesCache.set(cacheKey, { rate, cachedAt: Date.now() })
    return rate
  }

  /** Calculate US sales tax for an amount. */
  calculateUSSalesTax(amount: number, zip: string, state: string): { taxAmount: number; rate: number; breakdown: TaxJarRate } {
    const rate = this.lookupUSRate(zip, state)
    const taxAmount = Math.round(amount * rate.combinedRate * 100) / 100
    return { taxAmount, rate: rate.combinedRate, breakdown: rate }
  }

  /** Check if a state has nexus (tax obligation). */
  hasNexus(state: string): boolean {
    if (!this.taxJarConfig) return false
    return this.taxJarConfig.nexusStates.includes(state)
  }

  /** Get cached rate count. */
  get cachedRateCount(): number { return this.taxJarRatesCache.size }
}

export const taxReportingService = new TaxReportingService()
