import { RetentionPolicyService } from '../../src/services/security/retention-policy'

describe('RetentionPolicyService', () => {
  let service: RetentionPolicyService

  beforeEach(() => {
    service = new RetentionPolicyService()
  })

  afterEach(() => {
    service.destroy()
  })

  describe('Rule management', () => {
    it('adds and retrieves rules', () => {
      service.addRule({
        id: 'r1', name: 'Test', category: 'logs', retentionDays: 30,
        archiveBeforeDelete: false, legalHold: false, enabled: true,
      })
      expect(service.getRules().length).toBe(1)
      expect(service.getRule('r1')).toBeDefined()
    })

    it('removes rules', () => {
      service.addRule({
        id: 'r1', name: 'Test', category: 'logs', retentionDays: 30,
        archiveBeforeDelete: false, legalHold: false, enabled: true,
      })
      expect(service.removeRule('r1')).toBe(true)
      expect(service.getRules().length).toBe(0)
    })

    it('updates rules', () => {
      service.addRule({
        id: 'r1', name: 'Test', category: 'logs', retentionDays: 30,
        archiveBeforeDelete: false, legalHold: false, enabled: true,
      })
      expect(service.updateRule('r1', { retentionDays: 60 })).toBe(true)
      expect(service.getRule('r1')?.retentionDays).toBe(60)
    })

    it('loads default rules', () => {
      service.loadDefaultRules()
      expect(service.getRules().length).toBe(4)
    })
  })

  describe('Data ingestion', () => {
    it('ingests and retrieves records', () => {
      service.ingestRecord('logs', 'rec-1', { message: 'test' })
      expect(service.getRecords('logs').length).toBe(1)
    })

    it('returns empty for unknown category', () => {
      expect(service.getRecords('unknown')).toEqual([])
    })
  })

  describe('Cleanup execution', () => {
    it('deletes expired records', () => {
      service.addRule({
        id: 'r1', name: 'Short retention', category: 'logs', retentionDays: 0,
        archiveBeforeDelete: false, legalHold: false, enabled: true,
      })

      // Ingest a record with a past timestamp
      service.ingestRecord('logs', 'old-1', { msg: 'old' }, '2020-01-01T00:00:00Z')
      service.ingestRecord('logs', 'new-1', { msg: 'new' })

      const results = service.executeCleanup(false)
      expect(results.length).toBe(1)
      expect(results[0].deletedCount).toBe(1)
      expect(results[0].expiredCount).toBe(1)
      expect(service.getRecords('logs').length).toBe(1)
    })

    it('archives before deleting when configured', () => {
      service.addRule({
        id: 'r1', name: 'Archive rule', category: 'logs', retentionDays: 0,
        archiveBeforeDelete: true, legalHold: false, enabled: true,
      })

      service.ingestRecord('logs', 'old-1', { msg: 'archived' }, '2020-01-01T00:00:00Z')

      const results = service.executeCleanup(false)
      expect(results[0].archivedCount).toBe(1)
      expect(results[0].deletedCount).toBe(1)
      expect(service.getArchives().length).toBe(1)
      expect(service.getArchives()[0].data.msg).toBe('archived')
    })

    it('skips records under legal hold', () => {
      service.addRule({
        id: 'r1', name: 'Legal hold', category: 'logs', retentionDays: 0,
        archiveBeforeDelete: false, legalHold: true, enabled: true,
      })

      service.ingestRecord('logs', 'old-1', { msg: 'held' }, '2020-01-01T00:00:00Z')

      const results = service.executeCleanup(false)
      expect(results[0].skippedLegalHold).toBe(1)
      expect(results[0].deletedCount).toBe(0)
      expect(service.getRecords('logs').length).toBe(1)
    })

    it('dry run does not delete', () => {
      service.addRule({
        id: 'r1', name: 'Dry run', category: 'logs', retentionDays: 0,
        archiveBeforeDelete: false, legalHold: false, enabled: true,
      })

      service.ingestRecord('logs', 'old-1', { msg: 'test' }, '2020-01-01T00:00:00Z')

      const results = service.executeCleanup(true)
      expect(results[0].expiredCount).toBe(1)
      expect(results[0].deletedCount).toBe(0)
      expect(service.getRecords('logs').length).toBe(1)
    })

    it('skips disabled rules', () => {
      service.addRule({
        id: 'r1', name: 'Disabled', category: 'logs', retentionDays: 0,
        archiveBeforeDelete: false, legalHold: false, enabled: false,
      })

      service.ingestRecord('logs', 'old-1', { msg: 'test' }, '2020-01-01T00:00:00Z')

      const results = service.executeCleanup(false)
      expect(results.length).toBe(0)
    })
  })

  describe('Legal hold', () => {
    it('sets and clears legal hold', () => {
      service.addRule({
        id: 'r1', name: 'Test', category: 'logs', retentionDays: 30,
        archiveBeforeDelete: false, legalHold: false, enabled: true,
      })

      expect(service.setLegalHold('r1', true)).toBe(true)
      expect(service.getRule('r1')?.legalHold).toBe(true)

      expect(service.setLegalHold('r1', false)).toBe(true)
      expect(service.getRule('r1')?.legalHold).toBe(false)
    })

    it('returns false for unknown rule', () => {
      expect(service.setLegalHold('unknown', true)).toBe(false)
    })
  })
})
