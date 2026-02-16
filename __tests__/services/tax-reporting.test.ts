import { TaxReportingService } from '../../src/services/billing/tax-reporting.service'

describe('TaxReportingService', () => {
  let service: TaxReportingService

  beforeEach(() => {
    service = new TaxReportingService()
    service.recordTransaction({ invoiceId: 'inv-1', customerId: 'c1', amount: 100, taxAmount: 20, taxRate: 0.20, jurisdiction: 'FR', country: 'FR', taxType: 'vat', reverseCharge: false, date: '2025-01-05T00:00:00Z' })
    service.recordTransaction({ invoiceId: 'inv-2', customerId: 'c2', amount: 200, taxAmount: 38, taxRate: 0.19, jurisdiction: 'DE', country: 'DE', taxType: 'vat', reverseCharge: false, date: '2025-01-10T00:00:00Z' })
    service.recordTransaction({ invoiceId: 'inv-3', customerId: 'c3', amount: 150, taxAmount: 0, taxRate: 0, jurisdiction: 'DE-B2B', country: 'DE', taxType: 'vat', reverseCharge: true, date: '2025-01-15T00:00:00Z' })
    service.recordTransaction({ invoiceId: 'inv-4', customerId: 'c4', amount: 300, taxAmount: 24, taxRate: 0.08, jurisdiction: 'NY', country: 'US', state: 'NY', taxType: 'sales_tax', reverseCharge: false, date: '2025-01-20T00:00:00Z' })
  })

  describe('Transaction tracking', () => {
    it('records transactions', () => {
      expect(service.transactionCount).toBe(4)
    })

    it('filters by date range', () => {
      const txs = service.getTransactions('2025-01-10T00:00:00Z', '2025-01-15T00:00:00Z')
      expect(txs.length).toBe(2)
    })

    it('gets all transactions', () => {
      expect(service.getTransactions().length).toBe(4)
    })
  })

  describe('Report generation', () => {
    it('generates a tax report', () => {
      const report = service.generateReport('Q1 2025', '2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z', 'monthly')
      expect(report.transactionCount).toBe(4)
      expect(report.totalRevenue).toBe(750)
      expect(report.totalTaxCollected).toBe(82) // 20 + 38 + 0 + 24
    })

    it('computes tax liability (excludes reverse charge)', () => {
      const report = service.generateReport('Q1', '2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z')
      expect(report.totalTaxLiability).toBe(82) // reverse charge tx has 0 tax
    })

    it('groups by jurisdiction', () => {
      const report = service.generateReport('Q1', '2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z')
      expect(report.byJurisdiction.length).toBeGreaterThan(0)
      const fr = report.byJurisdiction.find(j => j.jurisdiction === 'FR')
      expect(fr).toBeDefined()
      expect(fr!.taxCollected).toBe(20)
    })

    it('groups by tax type', () => {
      const report = service.generateReport('Q1', '2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z')
      expect(report.byTaxType.length).toBe(2) // vat, sales_tax
    })

    it('retrieves reports', () => {
      service.generateReport('A', '2025-01-01', '2025-01-31')
      service.generateReport('B', '2025-02-01', '2025-02-28')
      expect(service.getReports().length).toBe(2)
    })
  })

  describe('Filing export', () => {
    it('exports CSV', () => {
      const report = service.generateReport('Q1', '2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z')
      const exp = service.exportForFiling(report.id, 'csv')
      expect(exp).not.toBeNull()
      expect(exp!.format).toBe('csv')
      expect(exp!.content).toContain('Jurisdiction')
      expect(exp!.content).toContain('FR')
    })

    it('exports JSON', () => {
      const report = service.generateReport('Q1', '2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z')
      const exp = service.exportForFiling(report.id, 'json')
      expect(exp).not.toBeNull()
      const parsed = JSON.parse(exp!.content)
      expect(parsed.jurisdictions.length).toBeGreaterThan(0)
    })

    it('returns null for unknown report', () => {
      expect(service.exportForFiling('unknown')).toBeNull()
    })
  })

  describe('TaxJar integration', () => {
    it('configures TaxJar', () => {
      service.configureTaxJar({
        apiKey: 'tj_test_123', sandbox: true,
        nexusStates: ['CA', 'NY', 'TX'],
        fromAddress: { street: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
      })
      expect(service.isTaxJarConfigured()).toBe(true)
      expect(service.getTaxJarConfig()!.nexusStates).toContain('CA')
    })

    it('looks up US rate', () => {
      const rate = service.lookupUSRate('94105', 'CA')
      expect(rate.state).toBe('CA')
      expect(rate.stateRate).toBe(0.0725)
      expect(rate.combinedRate).toBeGreaterThan(rate.stateRate)
    })

    it('caches rates', () => {
      service.lookupUSRate('94105', 'CA')
      service.lookupUSRate('10001', 'NY')
      expect(service.cachedRateCount).toBe(2)
    })

    it('returns zero rate for tax-free states', () => {
      const rate = service.lookupUSRate('97201', 'OR')
      expect(rate.stateRate).toBe(0)
      expect(rate.combinedRate).toBe(0)
    })

    it('calculates US sales tax', () => {
      const result = service.calculateUSSalesTax(100, '94105', 'CA')
      expect(result.taxAmount).toBeGreaterThan(0)
      expect(result.rate).toBeGreaterThan(0)
      expect(result.breakdown.state).toBe('CA')
    })

    it('checks nexus', () => {
      service.configureTaxJar({
        apiKey: 'tj_test', sandbox: true, nexusStates: ['CA', 'NY'],
        fromAddress: { street: '', city: '', state: 'CA', zip: '94105', country: 'US' },
      })
      expect(service.hasNexus('CA')).toBe(true)
      expect(service.hasNexus('TX')).toBe(false)
    })

    it('returns false for nexus without config', () => {
      expect(service.hasNexus('CA')).toBe(false)
    })

    it('identifies freight taxable states', () => {
      const caRate = service.lookupUSRate('94105', 'CA')
      expect(caRate.freightTaxable).toBe(true)
      const orRate = service.lookupUSRate('97201', 'OR')
      expect(orRate.freightTaxable).toBe(false)
    })
  })
})
