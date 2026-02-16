import { ABACService } from '../../../lib/mcp/middleware/abac'

describe('ABACService', () => {
  let abac: ABACService

  beforeEach(() => {
    abac = new ABACService()
  })

  describe('Policy management', () => {
    it('adds and retrieves policies', () => {
      abac.addPolicy({
        id: 'p1', name: 'Allow admins', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { role: { operator: 'equals', value: 'admin' } } },
      })
      expect(abac.getPolicies().length).toBe(1)
      expect(abac.getPolicy('p1')).toBeDefined()
    })

    it('removes policies', () => {
      abac.addPolicy({
        id: 'p1', name: 'Test', effect: 'allow', priority: 1, enabled: true, conditions: {},
      })
      expect(abac.removePolicy('p1')).toBe(true)
      expect(abac.getPolicies().length).toBe(0)
    })

    it('sorts policies by priority', () => {
      abac.addPolicy({ id: 'low', name: 'Low', effect: 'allow', priority: 10, enabled: true, conditions: {} })
      abac.addPolicy({ id: 'high', name: 'High', effect: 'deny', priority: 1, enabled: true, conditions: {} })
      expect(abac.getPolicies()[0].id).toBe('high')
    })
  })

  describe('Evaluation — subject conditions', () => {
    it('allows when subject matches equals condition', () => {
      abac.addPolicy({
        id: 'admin-allow', name: 'Admin access', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { role: { operator: 'equals', value: 'admin' } } },
      })

      const result = abac.evaluate({
        subject: { role: 'admin' }, resource: {}, action: 'read',
      })
      expect(result.allowed).toBe(true)
      expect(result.matchedPolicy).toBe('admin-allow')
    })

    it('denies when subject does not match', () => {
      abac.addPolicy({
        id: 'admin-allow', name: 'Admin access', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { role: { operator: 'equals', value: 'admin' } } },
      })

      const result = abac.evaluate({
        subject: { role: 'viewer' }, resource: {}, action: 'read',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('default deny')
    })
  })

  describe('Evaluation — operators', () => {
    it('in operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Dept check', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { department: { operator: 'in', value: ['engineering', 'security'] } } },
      })

      expect(abac.evaluate({ subject: { department: 'engineering' }, resource: {}, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: { department: 'marketing' }, resource: {}, action: 'read' }).allowed).toBe(false)
    })

    it('not_in operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Block interns', effect: 'deny', priority: 1, enabled: true,
        conditions: { subject: { level: { operator: 'not_in', value: ['intern', 'contractor'] } } },
      })

      // 'employee' is not_in the list, so condition matches → deny
      expect(abac.evaluate({ subject: { level: 'employee' }, resource: {}, action: 'read' }).allowed).toBe(false)
    })

    it('greater_than operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Senior only', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { clearance: { operator: 'greater_than', value: 3 } } },
      })

      expect(abac.evaluate({ subject: { clearance: 5 }, resource: {}, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: { clearance: 2 }, resource: {}, action: 'read' }).allowed).toBe(false)
    })

    it('between operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Business hours', effect: 'allow', priority: 1, enabled: true,
        conditions: { environment: { hour: { operator: 'between', value: [9, 17] } } },
      })

      expect(abac.evaluate({ subject: {}, resource: {}, action: 'read', environment: { hour: 12 } }).allowed).toBe(true)
      expect(abac.evaluate({ subject: {}, resource: {}, action: 'read', environment: { hour: 22 } }).allowed).toBe(false)
    })

    it('contains operator (array)', () => {
      abac.addPolicy({
        id: 'p1', name: 'Has tag', effect: 'allow', priority: 1, enabled: true,
        conditions: { resource: { tags: { operator: 'contains', value: 'public' } } },
      })

      expect(abac.evaluate({ subject: {}, resource: { tags: ['public', 'docs'] }, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: {}, resource: { tags: ['private'] }, action: 'read' }).allowed).toBe(false)
    })

    it('starts_with operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'API path', effect: 'allow', priority: 1, enabled: true,
        conditions: { resource: { path: { operator: 'starts_with', value: '/api/v1' } } },
      })

      expect(abac.evaluate({ subject: {}, resource: { path: '/api/v1/tools' }, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: {}, resource: { path: '/admin/users' }, action: 'read' }).allowed).toBe(false)
    })

    it('regex operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Email domain', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { email: { operator: 'regex', value: '@company\\.com$' } } },
      })

      expect(abac.evaluate({ subject: { email: 'alice@company.com' }, resource: {}, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: { email: 'bob@other.com' }, resource: {}, action: 'read' }).allowed).toBe(false)
    })

    it('exists operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Has MFA', effect: 'allow', priority: 1, enabled: true,
        conditions: { subject: { mfaVerified: { operator: 'exists', value: true } } },
      })

      expect(abac.evaluate({ subject: { mfaVerified: true }, resource: {}, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: {}, resource: {}, action: 'read' }).allowed).toBe(false)
    })
  })

  describe('Evaluation — action conditions', () => {
    it('matches action with in operator', () => {
      abac.addPolicy({
        id: 'p1', name: 'Read-only', effect: 'allow', priority: 1, enabled: true,
        conditions: { action: { operator: 'in', value: ['read', 'list'] } },
      })

      expect(abac.evaluate({ subject: {}, resource: {}, action: 'read' }).allowed).toBe(true)
      expect(abac.evaluate({ subject: {}, resource: {}, action: 'delete' }).allowed).toBe(false)
    })
  })

  describe('Evaluation — combined conditions', () => {
    it('requires all conditions to match', () => {
      abac.addPolicy({
        id: 'p1', name: 'Admin + public resource', effect: 'allow', priority: 1, enabled: true,
        conditions: {
          subject: { role: { operator: 'equals', value: 'admin' } },
          resource: { sensitivity: { operator: 'equals', value: 'public' } },
          action: { operator: 'equals', value: 'read' },
        },
      })

      // All match
      expect(abac.evaluate({
        subject: { role: 'admin' }, resource: { sensitivity: 'public' }, action: 'read',
      }).allowed).toBe(true)

      // Subject doesn't match
      expect(abac.evaluate({
        subject: { role: 'viewer' }, resource: { sensitivity: 'public' }, action: 'read',
      }).allowed).toBe(false)

      // Action doesn't match
      expect(abac.evaluate({
        subject: { role: 'admin' }, resource: { sensitivity: 'public' }, action: 'write',
      }).allowed).toBe(false)
    })
  })

  describe('Evaluation — deny overrides', () => {
    it('deny policy with higher priority overrides allow', () => {
      abac.addPolicy({
        id: 'deny-sensitive', name: 'Deny sensitive', effect: 'deny', priority: 1, enabled: true,
        conditions: { resource: { sensitivity: { operator: 'equals', value: 'classified' } } },
      })
      abac.addPolicy({
        id: 'allow-all', name: 'Allow all', effect: 'allow', priority: 10, enabled: true,
        conditions: {},
      })

      const result = abac.evaluate({
        subject: { role: 'admin' }, resource: { sensitivity: 'classified' }, action: 'read',
      })
      expect(result.allowed).toBe(false)
      expect(result.matchedPolicy).toBe('deny-sensitive')
    })
  })

  describe('Disabled policies', () => {
    it('skips disabled policies', () => {
      abac.addPolicy({
        id: 'p1', name: 'Disabled', effect: 'allow', priority: 1, enabled: false, conditions: {},
      })

      const result = abac.evaluate({ subject: {}, resource: {}, action: 'read' })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('default deny')
    })
  })

  describe('evaluateAll', () => {
    it('returns match status for all policies', () => {
      abac.addPolicy({ id: 'p1', name: 'A', effect: 'allow', priority: 1, enabled: true, conditions: {} })
      abac.addPolicy({
        id: 'p2', name: 'B', effect: 'deny', priority: 2, enabled: true,
        conditions: { subject: { role: { operator: 'equals', value: 'admin' } } },
      })

      const results = abac.evaluateAll({ subject: { role: 'viewer' }, resource: {}, action: 'read' })
      expect(results.length).toBe(2)
      expect(results[0].matches).toBe(true)  // p1 matches (no conditions)
      expect(results[1].matches).toBe(false) // p2 doesn't match
    })
  })
})
