import { ErrorTrackingService } from '../../src/services/analytics/error-tracking.service'

describe('ErrorTrackingService', () => {
  let service: ErrorTrackingService

  beforeEach(() => {
    service = new ErrorTrackingService()
  })

  describe('Capture', () => {
    it('captures an error', () => {
      const err = service.capture('Connection refused')
      expect(err.id).toBeDefined()
      expect(err.status).toBe('unresolved')
      expect(err.occurrences).toBe(1)
    })

    it('groups duplicate errors', () => {
      service.capture('Connection refused')
      const err2 = service.capture('Connection refused')
      expect(err2.occurrences).toBe(2)
      expect(service.totalGroups).toBe(1)
    })

    it('captures with context', () => {
      const err = service.capture('Not found', {
        level: 'warning',
        context: { userId: 'u1', url: '/api/test', environment: 'staging' },
        tags: { service: 'api' },
      })
      expect(err.level).toBe('warning')
      expect(err.context.userId).toBe('u1')
      expect(err.tags.service).toBe('api')
    })

    it('captures with breadcrumbs', () => {
      const err = service.capture('Crash', {
        breadcrumbs: [
          { timestamp: new Date().toISOString(), category: 'http', message: 'GET /api', level: 'info' },
        ],
      })
      expect(err.breadcrumbs.length).toBe(1)
    })

    it('captures with stack trace', () => {
      const err = service.capture('TypeError', { stack: 'Error: TypeError\n    at foo (/app/src/index.ts:10)\n    at bar (/app/src/utils.ts:20)' })
      expect(err.stack).toBeDefined()
    })
  })

  describe('Retrieval', () => {
    it('gets error by ID', () => {
      const err = service.capture('Test')
      expect(service.getError(err.id)?.message).toBe('Test')
    })

    it('lists errors', () => {
      service.capture('A')
      service.capture('B')
      expect(service.getErrors().length).toBe(2)
    })

    it('filters by status', () => {
      const err = service.capture('A')
      service.capture('B')
      service.resolve(err.id)
      expect(service.getErrors('resolved').length).toBe(1)
      expect(service.getErrors('unresolved').length).toBe(1)
    })

    it('lists groups sorted by count', () => {
      service.capture('Frequent')
      service.capture('Frequent')
      service.capture('Rare')
      const groups = service.getGroups()
      expect(groups[0].count).toBeGreaterThanOrEqual(groups[1].count)
    })
  })

  describe('Resolution', () => {
    it('resolves an error', () => {
      const err = service.capture('Bug')
      expect(service.resolve(err.id)).toBe(true)
      expect(service.getError(err.id)!.status).toBe('resolved')
    })

    it('ignores an error', () => {
      const err = service.capture('Noise')
      expect(service.ignore(err.id)).toBe(true)
      expect(service.getError(err.id)!.status).toBe('ignored')
    })

    it('mutes a group', () => {
      const err = service.capture('Spam')
      expect(service.mute(err.fingerprint)).toBe(true)
      expect(service.getError(err.id)!.status).toBe('muted')
    })

    it('assigns an error', () => {
      const err = service.capture('Bug')
      expect(service.assign(err.id, 'alice')).toBe(true)
      expect(service.getError(err.id)!.assignee).toBe('alice')
    })
  })

  describe('Sentry payload', () => {
    it('generates Sentry-compatible payload', () => {
      const err = service.capture('TypeError: x is not a function', {
        stack: 'Error: TypeError\n    at foo (/app/src/index.ts:10)',
        context: { userId: 'u1', environment: 'production', release: 'v1.0' },
        tags: { service: 'api' },
      })
      const payload = service.toSentryPayload(err.id)
      expect(payload).not.toBeNull()
      expect(payload!.level).toBe('error')
      expect(payload!.exception).toBeDefined()
      expect(payload!.tags.service).toBe('api')
      expect(payload!.environment).toBe('production')
    })

    it('returns null for unknown error', () => {
      expect(service.toSentryPayload('unknown')).toBeNull()
    })
  })

  describe('Alert thresholds', () => {
    it('adds and lists thresholds', () => {
      service.addThreshold('High error rate', 'count', 5, 60)
      expect(service.getThresholds().length).toBe(1)
    })

    it('removes thresholds', () => {
      const t = service.addThreshold('Test', 'count', 10)
      expect(service.removeThreshold(t.id)).toBe(true)
    })

    it('triggers alerts when threshold exceeded', () => {
      service.addThreshold('Burst', 'count', 2, 60)
      service.capture('err1')
      service.capture('err2')
      service.capture('err3')
      expect(service.getTriggeredAlerts().length).toBeGreaterThan(0)
    })
  })

  describe('Trends', () => {
    it('returns trend data', () => {
      service.capture('Error')
      const trends = service.getTrends('day', 3)
      expect(trends.length).toBe(3)
    })
  })
})
