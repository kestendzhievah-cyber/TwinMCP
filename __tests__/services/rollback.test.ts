import { RollbackService } from '../../src/services/production/rollback.service'

describe('RollbackService', () => {
  let service: RollbackService

  beforeEach(() => { service = new RollbackService() })

  describe('Deployment versions', () => {
    it('registers a version', () => {
      const v = service.registerVersion('v1.0.0', ['app.tar.gz'])
      expect(v.status).toBe('active')
      expect(v.version).toBe('v1.0.0')
    })

    it('marks previous version on new deploy', () => {
      service.registerVersion('v1.0.0')
      service.registerVersion('v2.0.0')
      const history = service.getVersionHistory()
      const active = history.find(v => v.status === 'active')
      const previous = history.find(v => v.status === 'previous')
      expect(active!.version).toBe('v2.0.0')
      expect(previous!.version).toBe('v1.0.0')
    })

    it('rolls back to a previous version', () => {
      const v1 = service.registerVersion('v1.0.0')
      service.registerVersion('v2.0.0')
      expect(service.rollbackToVersion(v1.id)).toBe(true)
      expect(service.getActiveVersion()!.version).toBe('v1.0.0')
    })
  })

  describe('Database migrations', () => {
    it('registers up and down migrations', () => {
      const { up, down } = service.registerMigration('add_users', '001', 'CREATE TABLE users;', 'DROP TABLE users;')
      expect(up.direction).toBe('up')
      expect(down.direction).toBe('down')
    })

    it('applies a migration', () => {
      const { up } = service.registerMigration('add_col', '002', 'ALTER TABLE users ADD col;', 'ALTER TABLE users DROP col;')
      expect(service.applyMigration(up.id)).toBe(true)
      expect(service.getMigrations('up').find(m => m.id === up.id)!.status).toBe('applied')
    })

    it('rolls back a migration', () => {
      const { up } = service.registerMigration('add_col', '003', 'ALTER TABLE t ADD c;', 'ALTER TABLE t DROP c;')
      service.applyMigration(up.id)
      expect(service.rollbackMigration('003')).toBe(true)
    })

    it('lists pending migrations', () => {
      service.registerMigration('m1', '001', 'SQL1', 'SQL1_DOWN')
      service.registerMigration('m2', '002', 'SQL2', 'SQL2_DOWN')
      expect(service.getPendingMigrations().length).toBe(2)
    })
  })

  describe('Rollback plans', () => {
    it('creates a deployment plan', () => {
      const plan = service.createPlan('Rollback v2', 'deployment', 'v1.0.0', 'v2.0.0')
      expect(plan.steps.length).toBe(4)
      expect(plan.status).toBe('draft')
    })

    it('creates a full plan with migration steps', () => {
      const plan = service.createPlan('Full rollback', 'full', 'v1.0.0', 'v2.0.0')
      expect(plan.steps.length).toBe(6)
    })

    it('approves and executes a plan', () => {
      const plan = service.createPlan('Test', 'deployment', 'v1', 'v2')
      expect(service.approvePlan(plan.id)).toBe(true)
      expect(service.executePlan(plan.id)).toBe(true)
      expect(service.getPlan(plan.id)!.status).toBe('completed')
      expect(plan.steps.every(s => s.status === 'completed')).toBe(true)
    })

    it('cannot execute unapproved plan', () => {
      const plan = service.createPlan('Test', 'deployment', 'v1', 'v2')
      expect(service.executePlan(plan.id)).toBe(false)
    })
  })

  describe('Automatic triggers', () => {
    it('adds a trigger', () => {
      const trigger = service.addTrigger('High error rate', 'error_rate', { metric: 'error_rate', operator: 'gt', threshold: 0.05 })
      expect(trigger.enabled).toBe(true)
    })

    it('evaluates trigger condition', () => {
      const trigger = service.addTrigger('Errors', 'error_rate', { metric: 'error_rate', operator: 'gt', threshold: 0.05 })
      expect(service.evaluateTrigger(trigger.id, 0.1)).toBe(true)
      expect(service.evaluateTrigger(trigger.id, 0.01)).toBe(false)
    })

    it('respects cooldown', () => {
      const trigger = service.addTrigger('Errors', 'error_rate', { metric: 'error_rate', operator: 'gt', threshold: 0.05 }, 60)
      service.evaluateTrigger(trigger.id, 0.1) // fires
      expect(service.evaluateTrigger(trigger.id, 0.1)).toBe(false) // cooldown
    })
  })

  describe('Migration script generation', () => {
    it('generates add column scripts', () => {
      const { up, down } = service.generateMigrationScript('users', [
        { type: 'add_column', column: 'email', dataType: 'VARCHAR(255)' },
      ])
      expect(up).toContain('ADD COLUMN email')
      expect(down).toContain('DROP COLUMN')
    })

    it('generates rename column scripts', () => {
      const { up, down } = service.generateMigrationScript('users', [
        { type: 'rename_column', column: 'name', newColumn: 'full_name' },
      ])
      expect(up).toContain('RENAME COLUMN name TO full_name')
      expect(down).toContain('RENAME COLUMN full_name TO name')
    })
  })

  it('tracks audit history', () => {
    service.registerVersion('v1.0.0')
    expect(service.historyCount).toBeGreaterThan(0)
  })
})
