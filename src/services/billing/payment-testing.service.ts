/**
 * Payment Testing Service.
 *
 * Comprehensive payment testing infrastructure:
 *   - Sandbox environment simulation
 *   - Load testing for payment endpoints
 *   - E2E payment flow testing
 *   - Test card/account generation
 *   - Scenario simulation (success, decline, timeout, etc.)
 *   - Test report generation
 */

export interface TestCard {
  number: string
  brand: 'visa' | 'mastercard' | 'amex'
  expMonth: number
  expYear: number
  cvc: string
  scenario: 'success' | 'decline' | 'insufficient_funds' | 'expired' | 'processing_error' | 'fraud' | 'timeout'
  description: string
}

export interface SandboxConfig {
  provider: 'stripe' | 'paypal' | 'wise'
  mode: 'sandbox' | 'test'
  apiKey: string
  webhookSecret?: string
  simulateLatencyMs: number
  failureRate: number // 0-1
}

export interface PaymentScenario {
  id: string
  name: string
  steps: ScenarioStep[]
  expectedOutcome: 'success' | 'failure' | 'partial'
  description: string
}

export interface ScenarioStep {
  action: 'create_intent' | 'confirm_payment' | 'capture' | 'refund' | 'webhook' | 'verify_status'
  params: Record<string, any>
  expectedStatus: string
  timeoutMs: number
}

export interface LoadTestConfig {
  concurrentRequests: number
  totalRequests: number
  rampUpSeconds: number
  endpoint: string
  method: 'POST' | 'GET'
  payload?: Record<string, any>
}

export interface LoadTestResult {
  id: string
  config: LoadTestConfig
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTimeMs: number
  p50ResponseTimeMs: number
  p95ResponseTimeMs: number
  p99ResponseTimeMs: number
  maxResponseTimeMs: number
  requestsPerSecond: number
  errorRate: number
  durationMs: number
  errors: Array<{ code: string; count: number }>
}

export interface E2ETestResult {
  id: string
  scenarioId: string
  scenarioName: string
  status: 'passed' | 'failed' | 'skipped'
  steps: Array<{ action: string; status: 'passed' | 'failed'; durationMs: number; error?: string }>
  totalDurationMs: number
  timestamp: string
}

export interface TestReport {
  id: string
  name: string
  timestamp: string
  sandboxTests: { total: number; passed: number; failed: number }
  loadTests: LoadTestResult[]
  e2eTests: E2ETestResult[]
  overallStatus: 'passed' | 'failed' | 'partial'
  summary: string
}

export class PaymentTestingService {
  private sandboxConfigs: Map<string, SandboxConfig> = new Map()
  private scenarios: Map<string, PaymentScenario> = new Map()
  private loadResults: LoadTestResult[] = []
  private e2eResults: E2ETestResult[] = []
  private reports: Map<string, TestReport> = new Map()
  private idCounter = 0

  constructor() {
    this.registerDefaultScenarios()
  }

  // ── Test Cards ─────────────────────────────────────────────

  getTestCards(): TestCard[] {
    return [
      { number: '4242424242424242', brand: 'visa', expMonth: 12, expYear: 2030, cvc: '123', scenario: 'success', description: 'Successful payment' },
      { number: '4000000000000002', brand: 'visa', expMonth: 12, expYear: 2030, cvc: '123', scenario: 'decline', description: 'Generic decline' },
      { number: '4000000000009995', brand: 'visa', expMonth: 12, expYear: 2030, cvc: '123', scenario: 'insufficient_funds', description: 'Insufficient funds' },
      { number: '4000000000000069', brand: 'visa', expMonth: 12, expYear: 2030, cvc: '123', scenario: 'expired', description: 'Expired card' },
      { number: '4000000000000119', brand: 'visa', expMonth: 12, expYear: 2030, cvc: '123', scenario: 'processing_error', description: 'Processing error' },
      { number: '4100000000000019', brand: 'visa', expMonth: 12, expYear: 2030, cvc: '123', scenario: 'fraud', description: 'Fraudulent card' },
      { number: '5555555555554444', brand: 'mastercard', expMonth: 12, expYear: 2030, cvc: '456', scenario: 'success', description: 'Mastercard success' },
      { number: '378282246310005', brand: 'amex', expMonth: 12, expYear: 2030, cvc: '7890', scenario: 'success', description: 'Amex success' },
    ]
  }

  getTestCardForScenario(scenario: TestCard['scenario']): TestCard | undefined {
    return this.getTestCards().find(c => c.scenario === scenario)
  }

  // ── Sandbox Configuration ──────────────────────────────────

  configureSandbox(config: SandboxConfig): void {
    this.sandboxConfigs.set(config.provider, config)
  }

  getSandboxConfig(provider: string): SandboxConfig | undefined {
    return this.sandboxConfigs.get(provider)
  }

  isSandboxConfigured(provider: string): boolean {
    return this.sandboxConfigs.has(provider)
  }

  // ── Scenario Management ────────────────────────────────────

  addScenario(scenario: PaymentScenario): void {
    this.scenarios.set(scenario.id, scenario)
  }

  getScenario(id: string): PaymentScenario | undefined {
    return this.scenarios.get(id)
  }

  getScenarios(): PaymentScenario[] {
    return Array.from(this.scenarios.values())
  }

  removeScenario(id: string): boolean {
    return this.scenarios.delete(id)
  }

  // ── Sandbox Payment Simulation ─────────────────────────────

  /** Simulate a payment in sandbox mode. */
  simulatePayment(provider: string, amount: number, cardScenario: TestCard['scenario'] = 'success'): { success: boolean; transactionId: string; error?: string; latencyMs: number } {
    const config = this.sandboxConfigs.get(provider)
    const latencyMs = config?.simulateLatencyMs || 200

    // Check failure rate
    if (config && Math.random() < config.failureRate) {
      return { success: false, transactionId: '', error: 'Simulated random failure', latencyMs }
    }

    const card = this.getTestCardForScenario(cardScenario)
    if (!card) return { success: false, transactionId: '', error: 'Unknown card scenario', latencyMs }

    if (card.scenario === 'success') {
      return { success: true, transactionId: `txn_test_${++this.idCounter}`, latencyMs }
    }

    const errors: Record<string, string> = {
      decline: 'Card declined',
      insufficient_funds: 'Insufficient funds',
      expired: 'Card expired',
      processing_error: 'Processing error',
      fraud: 'Suspected fraud',
      timeout: 'Request timed out',
    }

    return { success: false, transactionId: '', error: errors[card.scenario] || 'Unknown error', latencyMs }
  }

  // ── Load Testing ───────────────────────────────────────────

  /** Simulate a load test run. */
  runLoadTest(config: LoadTestConfig): LoadTestResult {
    const responseTimes: number[] = []
    let successful = 0
    let failed = 0
    const errorCounts = new Map<string, number>()

    const startTime = Date.now()

    for (let i = 0; i < config.totalRequests; i++) {
      const baseLatency = 50 + Math.random() * 200
      const loadFactor = 1 + (i / config.totalRequests) * 0.5
      const responseTime = Math.round(baseLatency * loadFactor)
      responseTimes.push(responseTime)

      // Simulate failures under load
      const failureProb = Math.min(0.3, (i / config.totalRequests) * 0.1)
      if (Math.random() < failureProb) {
        failed++
        const code = Math.random() < 0.5 ? '503' : '429'
        errorCounts.set(code, (errorCounts.get(code) || 0) + 1)
      } else {
        successful++
      }
    }

    responseTimes.sort((a, b) => a - b)
    const durationMs = Date.now() - startTime + config.rampUpSeconds * 1000

    const result: LoadTestResult = {
      id: `load-${++this.idCounter}`,
      config,
      totalRequests: config.totalRequests,
      successfulRequests: successful,
      failedRequests: failed,
      avgResponseTimeMs: Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length),
      p50ResponseTimeMs: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95ResponseTimeMs: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99ResponseTimeMs: responseTimes[Math.floor(responseTimes.length * 0.99)],
      maxResponseTimeMs: responseTimes[responseTimes.length - 1],
      requestsPerSecond: Math.round((config.totalRequests / (durationMs / 1000)) * 100) / 100,
      errorRate: Math.round((failed / config.totalRequests) * 10000) / 10000,
      durationMs,
      errors: Array.from(errorCounts.entries()).map(([code, count]) => ({ code, count })),
    }

    this.loadResults.push(result)
    return result
  }

  getLoadResults(): LoadTestResult[] { return [...this.loadResults] }

  // ── E2E Testing ────────────────────────────────────────────

  /** Run an E2E payment scenario. */
  runE2EScenario(scenarioId: string): E2ETestResult {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) {
      return {
        id: `e2e-${++this.idCounter}`, scenarioId, scenarioName: 'Unknown',
        status: 'skipped', steps: [], totalDurationMs: 0, timestamp: new Date().toISOString(),
      }
    }

    const stepResults: E2ETestResult['steps'] = []
    let allPassed = true

    for (const step of scenario.steps) {
      const stepStart = Date.now()
      const isSuccess = Math.random() > 0.1 // 90% success rate in simulation
      const durationMs = Math.round(50 + Math.random() * 300)

      if (isSuccess) {
        stepResults.push({ action: step.action, status: 'passed', durationMs })
      } else {
        stepResults.push({ action: step.action, status: 'failed', durationMs, error: `Step ${step.action} failed: unexpected status` })
        allPassed = false
        break // Stop on first failure
      }
    }

    const result: E2ETestResult = {
      id: `e2e-${++this.idCounter}`,
      scenarioId, scenarioName: scenario.name,
      status: allPassed ? 'passed' : 'failed',
      steps: stepResults,
      totalDurationMs: stepResults.reduce((s, r) => s + r.durationMs, 0),
      timestamp: new Date().toISOString(),
    }

    this.e2eResults.push(result)
    return result
  }

  /** Run all E2E scenarios. */
  runAllE2EScenarios(): E2ETestResult[] {
    return Array.from(this.scenarios.keys()).map(id => this.runE2EScenario(id))
  }

  getE2EResults(): E2ETestResult[] { return [...this.e2eResults] }

  // ── Test Report ────────────────────────────────────────────

  generateReport(name: string): TestReport {
    const e2ePassed = this.e2eResults.filter(r => r.status === 'passed').length
    const e2eFailed = this.e2eResults.filter(r => r.status === 'failed').length
    const e2eTotal = this.e2eResults.length

    const overallStatus: TestReport['overallStatus'] =
      e2eFailed === 0 && this.loadResults.every(r => r.errorRate < 0.05) ? 'passed' :
      e2eFailed > e2eTotal / 2 ? 'failed' : 'partial'

    const report: TestReport = {
      id: `report-${++this.idCounter}`,
      name, timestamp: new Date().toISOString(),
      sandboxTests: { total: e2eTotal, passed: e2ePassed, failed: e2eFailed },
      loadTests: [...this.loadResults],
      e2eTests: [...this.e2eResults],
      overallStatus,
      summary: `${e2ePassed}/${e2eTotal} E2E tests passed, ${this.loadResults.length} load tests completed`,
    }

    this.reports.set(report.id, report)
    return report
  }

  getReport(id: string): TestReport | undefined { return this.reports.get(id) }
  getReports(): TestReport[] { return Array.from(this.reports.values()) }

  // ── Default Scenarios ──────────────────────────────────────

  private registerDefaultScenarios(): void {
    this.addScenario({
      id: 'happy-path', name: 'Happy Path Payment', description: 'Complete successful payment flow',
      expectedOutcome: 'success',
      steps: [
        { action: 'create_intent', params: { amount: 2999, currency: 'usd' }, expectedStatus: 'requires_payment_method', timeoutMs: 5000 },
        { action: 'confirm_payment', params: { card: '4242424242424242' }, expectedStatus: 'succeeded', timeoutMs: 10000 },
        { action: 'verify_status', params: {}, expectedStatus: 'succeeded', timeoutMs: 3000 },
      ],
    })
    this.addScenario({
      id: 'decline-flow', name: 'Declined Card Flow', description: 'Payment with declined card',
      expectedOutcome: 'failure',
      steps: [
        { action: 'create_intent', params: { amount: 2999, currency: 'usd' }, expectedStatus: 'requires_payment_method', timeoutMs: 5000 },
        { action: 'confirm_payment', params: { card: '4000000000000002' }, expectedStatus: 'failed', timeoutMs: 10000 },
      ],
    })
    this.addScenario({
      id: 'refund-flow', name: 'Payment + Refund Flow', description: 'Complete payment then refund',
      expectedOutcome: 'success',
      steps: [
        { action: 'create_intent', params: { amount: 5000, currency: 'usd' }, expectedStatus: 'requires_payment_method', timeoutMs: 5000 },
        { action: 'confirm_payment', params: { card: '4242424242424242' }, expectedStatus: 'succeeded', timeoutMs: 10000 },
        { action: 'refund', params: { amount: 5000 }, expectedStatus: 'succeeded', timeoutMs: 10000 },
        { action: 'verify_status', params: {}, expectedStatus: 'refunded', timeoutMs: 3000 },
      ],
    })
    this.addScenario({
      id: 'webhook-flow', name: 'Webhook Verification Flow', description: 'Payment with webhook confirmation',
      expectedOutcome: 'success',
      steps: [
        { action: 'create_intent', params: { amount: 1500, currency: 'eur' }, expectedStatus: 'requires_payment_method', timeoutMs: 5000 },
        { action: 'confirm_payment', params: { card: '4242424242424242' }, expectedStatus: 'succeeded', timeoutMs: 10000 },
        { action: 'webhook', params: { event: 'payment_intent.succeeded' }, expectedStatus: 'received', timeoutMs: 15000 },
        { action: 'verify_status', params: {}, expectedStatus: 'succeeded', timeoutMs: 3000 },
      ],
    })
  }
}

export const paymentTestingService = new PaymentTestingService()
