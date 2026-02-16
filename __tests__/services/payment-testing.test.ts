import { PaymentTestingService } from '../../src/services/billing/payment-testing.service'

describe('PaymentTestingService', () => {
  let service: PaymentTestingService

  beforeEach(() => {
    service = new PaymentTestingService()
  })

  describe('Test cards', () => {
    it('provides test cards', () => {
      const cards = service.getTestCards()
      expect(cards.length).toBeGreaterThanOrEqual(8)
    })

    it('includes success card', () => {
      const card = service.getTestCardForScenario('success')
      expect(card).toBeDefined()
      expect(card!.number).toBe('4242424242424242')
    })

    it('includes decline card', () => {
      const card = service.getTestCardForScenario('decline')
      expect(card).toBeDefined()
    })

    it('includes all failure scenarios', () => {
      const scenarios: Array<'decline' | 'insufficient_funds' | 'expired' | 'processing_error' | 'fraud'> = ['decline', 'insufficient_funds', 'expired', 'processing_error', 'fraud']
      for (const s of scenarios) {
        expect(service.getTestCardForScenario(s)).toBeDefined()
      }
    })

    it('includes multiple brands', () => {
      const cards = service.getTestCards()
      const brands = new Set(cards.map(c => c.brand))
      expect(brands.has('visa')).toBe(true)
      expect(brands.has('mastercard')).toBe(true)
      expect(brands.has('amex')).toBe(true)
    })
  })

  describe('Sandbox configuration', () => {
    it('configures sandbox', () => {
      service.configureSandbox({ provider: 'stripe', mode: 'sandbox', apiKey: 'sk_test_xxx', simulateLatencyMs: 100, failureRate: 0 })
      expect(service.isSandboxConfigured('stripe')).toBe(true)
    })

    it('gets sandbox config', () => {
      service.configureSandbox({ provider: 'stripe', mode: 'sandbox', apiKey: 'sk_test_xxx', simulateLatencyMs: 200, failureRate: 0.1 })
      const config = service.getSandboxConfig('stripe')
      expect(config!.simulateLatencyMs).toBe(200)
    })

    it('returns false for unconfigured provider', () => {
      expect(service.isSandboxConfigured('stripe')).toBe(false)
    })
  })

  describe('Payment simulation', () => {
    it('simulates successful payment', () => {
      service.configureSandbox({ provider: 'stripe', mode: 'sandbox', apiKey: 'sk_test', simulateLatencyMs: 0, failureRate: 0 })
      const result = service.simulatePayment('stripe', 2999, 'success')
      expect(result.success).toBe(true)
      expect(result.transactionId).toContain('txn_test_')
    })

    it('simulates declined payment', () => {
      const result = service.simulatePayment('stripe', 2999, 'decline')
      expect(result.success).toBe(false)
      expect(result.error).toContain('declined')
    })

    it('simulates insufficient funds', () => {
      const result = service.simulatePayment('stripe', 2999, 'insufficient_funds')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient')
    })

    it('simulates expired card', () => {
      const result = service.simulatePayment('stripe', 2999, 'expired')
      expect(result.success).toBe(false)
    })

    it('simulates processing error', () => {
      const result = service.simulatePayment('stripe', 2999, 'processing_error')
      expect(result.success).toBe(false)
    })

    it('simulates fraud detection', () => {
      const result = service.simulatePayment('stripe', 2999, 'fraud')
      expect(result.success).toBe(false)
      expect(result.error).toContain('fraud')
    })
  })

  describe('Scenarios', () => {
    it('has default scenarios', () => {
      expect(service.getScenarios().length).toBeGreaterThanOrEqual(4)
    })

    it('includes happy path', () => {
      expect(service.getScenario('happy-path')).toBeDefined()
    })

    it('includes decline flow', () => {
      expect(service.getScenario('decline-flow')).toBeDefined()
    })

    it('includes refund flow', () => {
      expect(service.getScenario('refund-flow')).toBeDefined()
    })

    it('includes webhook flow', () => {
      expect(service.getScenario('webhook-flow')).toBeDefined()
    })

    it('adds custom scenario', () => {
      service.addScenario({
        id: 'custom', name: 'Custom', description: 'Custom test',
        expectedOutcome: 'success',
        steps: [{ action: 'create_intent', params: {}, expectedStatus: 'ok', timeoutMs: 5000 }],
      })
      expect(service.getScenario('custom')).toBeDefined()
    })

    it('removes a scenario', () => {
      expect(service.removeScenario('happy-path')).toBe(true)
      expect(service.getScenario('happy-path')).toBeUndefined()
    })
  })

  describe('Load testing', () => {
    it('runs a load test', () => {
      const result = service.runLoadTest({
        concurrentRequests: 10, totalRequests: 100,
        rampUpSeconds: 1, endpoint: '/api/payments', method: 'POST',
      })
      expect(result.totalRequests).toBe(100)
      expect(result.successfulRequests + result.failedRequests).toBe(100)
      expect(result.avgResponseTimeMs).toBeGreaterThan(0)
      expect(result.p95ResponseTimeMs).toBeGreaterThanOrEqual(result.p50ResponseTimeMs)
      expect(result.requestsPerSecond).toBeGreaterThan(0)
    })

    it('computes error rate', () => {
      const result = service.runLoadTest({
        concurrentRequests: 5, totalRequests: 50,
        rampUpSeconds: 0, endpoint: '/api/payments', method: 'POST',
      })
      expect(result.errorRate).toBeGreaterThanOrEqual(0)
      expect(result.errorRate).toBeLessThanOrEqual(1)
    })

    it('tracks load results', () => {
      service.runLoadTest({ concurrentRequests: 5, totalRequests: 20, rampUpSeconds: 0, endpoint: '/api/test', method: 'GET' })
      expect(service.getLoadResults().length).toBe(1)
    })
  })

  describe('E2E testing', () => {
    it('runs an E2E scenario', () => {
      const result = service.runE2EScenario('happy-path')
      expect(result.scenarioName).toBe('Happy Path Payment')
      expect(['passed', 'failed']).toContain(result.status)
      expect(result.steps.length).toBeGreaterThan(0)
      expect(result.totalDurationMs).toBeGreaterThan(0)
    })

    it('returns skipped for unknown scenario', () => {
      const result = service.runE2EScenario('unknown')
      expect(result.status).toBe('skipped')
    })

    it('runs all scenarios', () => {
      const results = service.runAllE2EScenarios()
      expect(results.length).toBeGreaterThanOrEqual(4)
    })

    it('tracks E2E results', () => {
      service.runE2EScenario('happy-path')
      expect(service.getE2EResults().length).toBe(1)
    })
  })

  describe('Test report', () => {
    it('generates a test report', () => {
      service.runE2EScenario('happy-path')
      service.runE2EScenario('decline-flow')
      service.runLoadTest({ concurrentRequests: 5, totalRequests: 20, rampUpSeconds: 0, endpoint: '/api/test', method: 'POST' })

      const report = service.generateReport('Payment Test Suite')
      expect(report.name).toBe('Payment Test Suite')
      expect(report.e2eTests.length).toBe(2)
      expect(report.loadTests.length).toBe(1)
      expect(['passed', 'failed', 'partial']).toContain(report.overallStatus)
      expect(report.summary).toContain('E2E')
    })

    it('retrieves reports', () => {
      service.generateReport('A')
      service.generateReport('B')
      expect(service.getReports().length).toBe(2)
    })
  })
})
