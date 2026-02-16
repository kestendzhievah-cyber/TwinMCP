import { ComplianceLogger } from '../../src/services/security/compliance-logger'

describe('ComplianceLogger', () => {
  let logger: ComplianceLogger

  beforeEach(() => {
    logger = new ComplianceLogger()
  })

  describe('Logging', () => {
    it('logs an access control event', () => {
      const entry = logger.logAccessControl(
        { userId: 'user-1', email: 'alice@test.com' },
        'login',
        { type: 'auth', id: 'session-1' },
        'success'
      )
      expect(entry.id).toBeDefined()
      expect(entry.category).toBe('access_control')
      expect(entry.outcome).toBe('success')
      expect(entry.hash).toBeDefined()
      expect(entry.hash.length).toBe(64)
    })

    it('logs a data access event', () => {
      const entry = logger.logDataAccess(
        { userId: 'user-1' },
        'read',
        { type: 'database', name: 'users' },
        'success'
      )
      expect(entry.category).toBe('data_access')
    })

    it('logs a system operation', () => {
      const entry = logger.logSystemOperation(
        'deployment',
        { type: 'service', name: 'api-gateway' },
        'success',
        { version: '1.2.3' }
      )
      expect(entry.category).toBe('system_operations')
      expect(entry.actor.userId).toBe('system')
    })

    it('logs an incident with correct severity', () => {
      const entry = logger.logIncident(
        'critical',
        'unauthorized_access_attempt',
        { type: 'api', id: '/admin' }
      )
      expect(entry.category).toBe('incident_response')
      expect(entry.severity).toBe('critical')
      expect(entry.outcome).toBe('failure')
    })
  })

  describe('Hash chain integrity', () => {
    it('creates a chain of hashes', () => {
      const e1 = logger.log({
        category: 'access_control', severity: 'info',
        actor: { userId: 'u1' }, action: 'login',
        resource: { type: 'auth' }, outcome: 'success',
      })
      const e2 = logger.log({
        category: 'data_access', severity: 'info',
        actor: { userId: 'u1' }, action: 'read',
        resource: { type: 'db' }, outcome: 'success',
      })

      expect(e1.previousHash).toBe('0'.repeat(64))
      expect(e2.previousHash).toBe(e1.hash)
    })

    it('verifies integrity of untampered logs', () => {
      for (let i = 0; i < 5; i++) {
        logger.log({
          category: 'access_control', severity: 'info',
          actor: { userId: `u${i}` }, action: 'read',
          resource: { type: 'test' }, outcome: 'success',
        })
      }
      expect(logger.verifyIntegrity().valid).toBe(true)
    })

    it('detects tampered logs via hash chain', () => {
      logger.log({
        category: 'access_control', severity: 'info',
        actor: { userId: 'u1' }, action: 'login',
        resource: { type: 'auth' }, outcome: 'success',
      })
      logger.log({
        category: 'access_control', severity: 'info',
        actor: { userId: 'u2' }, action: 'login',
        resource: { type: 'auth' }, outcome: 'success',
      })

      // getLogs returns shallow copy — objects are shared references.
      // Tampering via the reference breaks the hash chain.
      const logs = logger.getLogs();
      (logs[0] as any).action = 'TAMPERED'

      const result = logger.verifyIntegrity()
      expect(result.valid).toBe(false)
      expect(result.brokenAt).toBe(0)
    })
  })

  describe('Querying', () => {
    beforeEach(() => {
      logger.logAccessControl({ userId: 'u1' }, 'login', { type: 'auth' }, 'success')
      logger.logDataAccess({ userId: 'u1' }, 'read', { type: 'db' }, 'success')
      logger.logIncident('critical', 'breach', { type: 'network' })
      logger.logSystemOperation('deploy', { type: 'service' }, 'success')
    })

    it('filters by category', () => {
      expect(logger.getByCategory('access_control').length).toBe(1)
      expect(logger.getByCategory('incident_response').length).toBe(1)
    })

    it('filters by severity', () => {
      expect(logger.getBySeverity('critical').length).toBe(1)
      expect(logger.getBySeverity('info').length).toBe(3)
    })

    it('returns total size', () => {
      expect(logger.size).toBe(4)
    })
  })

  describe('Report generation', () => {
    it('generates a compliance report', () => {
      logger.logAccessControl({ userId: 'u1' }, 'login', { type: 'auth' }, 'success')
      logger.logAccessControl({ userId: 'u2' }, 'login', { type: 'auth' }, 'denied')
      logger.logIncident('warning', 'alert', { type: 'ids' })

      const from = new Date(Date.now() - 60000)
      const to = new Date(Date.now() + 60000)
      const report = logger.generateReport(from, to)

      expect(report.summary.totalEvents).toBe(3)
      expect(report.summary.byCategory.access_control).toBe(2)
      expect(report.summary.byOutcome.success).toBe(1)
      expect(report.summary.byOutcome.denied).toBe(1)
      expect(report.summary.integrityValid).toBe(true)
    })
  })
})
