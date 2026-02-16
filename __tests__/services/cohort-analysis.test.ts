import { CohortAnalysisService } from '../../src/services/analytics/cohort-analysis.service'

describe('CohortAnalysisService', () => {
  let service: CohortAnalysisService

  beforeEach(() => {
    service = new CohortAnalysisService()
  })

  describe('Cohort definition', () => {
    it('creates a cohort', () => {
      const c = service.createCohort('Jan 2025', 'time', 'month')
      expect(c.type).toBe('time')
      expect(c.granularity).toBe('month')
    })

    it('lists cohorts', () => {
      service.createCohort('A', 'time')
      service.createCohort('B', 'behavior')
      expect(service.getCohorts().length).toBe(2)
    })

    it('removes a cohort', () => {
      const c = service.createCohort('Test', 'time')
      expect(service.removeCohort(c.id)).toBe(true)
    })
  })

  describe('User assignment', () => {
    it('adds users to cohort', () => {
      const c = service.createCohort('Jan', 'time')
      service.addUser('u1', c.id, '2025-01-15T00:00:00Z')
      service.addUser('u2', c.id, '2025-01-20T00:00:00Z')
      expect(service.getCohortUsers(c.id).length).toBe(2)
    })

    it('gets user cohorts', () => {
      const c1 = service.createCohort('A', 'time')
      const c2 = service.createCohort('B', 'behavior')
      service.addUser('u1', c1.id, '2025-01-01T00:00:00Z')
      service.addUser('u1', c2.id, '2025-01-01T00:00:00Z')
      expect(service.getUserCohorts('u1').length).toBe(2)
    })

    it('auto-assigns time cohort', () => {
      const c = service.createCohort('Signups', 'time', 'month')
      const count = service.autoAssignTimeCohort(c.id, [
        { userId: 'u1', signupDate: '2025-01-01T00:00:00Z' },
        { userId: 'u2', signupDate: '2025-01-15T00:00:00Z' },
      ])
      expect(count).toBe(2)
      expect(service.totalUsers).toBe(2)
    })

    it('returns 0 for non-time cohort auto-assign', () => {
      const c = service.createCohort('Behavior', 'behavior')
      expect(service.autoAssignTimeCohort(c.id, [{ userId: 'u1', signupDate: '2025-01-01T00:00:00Z' }])).toBe(0)
    })
  })

  describe('Event tracking', () => {
    it('tracks events', () => {
      service.trackEvent('u1', 'login')
      service.trackEventAt('u1', 'purchase', '2025-01-15T10:00:00Z', 29.99)
      expect(service.totalEvents).toBe(2)
    })
  })

  describe('Retention analysis', () => {
    it('analyzes retention', () => {
      const c = service.createCohort('Jan', 'time', 'month')
      service.addUser('u1', c.id, '2025-01-01T00:00:00Z')
      service.addUser('u2', c.id, '2025-01-05T00:00:00Z')

      // Simulate activity
      service.trackEventAt('u1', 'login', '2025-01-02T00:00:00Z')
      service.trackEventAt('u2', 'login', '2025-01-03T00:00:00Z')
      service.trackEventAt('u1', 'login', '2025-02-01T00:00:00Z')

      const report = service.analyzeRetention(c.id, 'login', 3)
      expect(report.totalUsers).toBe(2)
      expect(report.retention.length).toBeGreaterThan(0)
      expect(report.avgRetention.length).toBe(3)
    })

    it('returns empty for unknown cohort', () => {
      const report = service.analyzeRetention('unknown', 'login')
      expect(report.totalUsers).toBe(0)
    })

    it('tracks revenue per cohort', () => {
      const c = service.createCohort('Paying', 'time', 'month')
      service.addUser('u1', c.id, '2025-01-01T00:00:00Z')
      service.trackEventAt('u1', 'purchase', '2025-01-15T00:00:00Z', 50)

      const report = service.analyzeRetention(c.id, 'purchase', 2)
      const totalRevenue = Object.values(report.revenuePerCohort).reduce((s, v) => s + v, 0)
      expect(totalRevenue).toBe(50)
    })
  })
})
