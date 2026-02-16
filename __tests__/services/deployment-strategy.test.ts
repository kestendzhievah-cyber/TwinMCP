import { DeploymentStrategyService } from '../../src/services/production/deployment-strategy.service'

describe('DeploymentStrategyService', () => {
  let service: DeploymentStrategyService

  beforeEach(() => {
    service = new DeploymentStrategyService()
  })

  describe('Slot management', () => {
    it('initializes blue and green slots', () => {
      expect(service.getSlots().length).toBe(2)
      expect(service.getActiveSlot()!.name).toBe('blue')
      expect(service.getStandbySlot()!.name).toBe('green')
    })

    it('active slot has 100% traffic', () => {
      expect(service.getActiveSlot()!.trafficPercent).toBe(100)
    })

    it('standby slot has 0% traffic', () => {
      expect(service.getStandbySlot()!.trafficPercent).toBe(0)
    })
  })

  describe('Blue-green deployment', () => {
    it('deploys to standby', () => {
      const record = service.deployToStandby('v2.0.0')
      expect(record).not.toBeNull()
      expect(record!.version).toBe('v2.0.0')
      expect(record!.strategy).toBe('blue-green')
      expect(service.getStandbySlot()!.version).toBe('v2.0.0')
    })

    it('switches traffic', () => {
      const record = service.deployToStandby('v2.0.0')!
      expect(service.switchTraffic(record.id)).toBe(true)
      expect(service.getActiveSlot()!.version).toBe('v2.0.0')
      expect(service.getActiveSlot()!.trafficPercent).toBe(100)
    })

    it('does not switch if standby unhealthy', () => {
      service.deployToStandby('v2.0.0')
      const standby = service.getStandbySlot()!
      standby.healthStatus = 'unhealthy'
      expect(service.switchTraffic()).toBe(false)
    })

    it('rolls back', () => {
      const record = service.deployToStandby('v2.0.0')!
      service.switchTraffic(record.id)
      expect(service.rollback(record.id, 'High error rate')).toBe(true)
      const deployment = service.getDeployment(record.id)!
      expect(deployment.status).toBe('rolled_back')
      expect(deployment.rollbackReason).toBe('High error rate')
    })

    it('tracks deployment history', () => {
      service.deployToStandby('v2.0.0')
      service.deployToStandby('v3.0.0')
      expect(service.getDeployments().length).toBe(2)
    })
  })

  describe('Canary deployment', () => {
    it('starts a canary', () => {
      const record = service.startCanary('v2.0.0')
      expect(record).not.toBeNull()
      expect(record!.strategy).toBe('canary')
      expect(record!.status).toBe('in_progress')
    })

    it('starts with initial percent', () => {
      service.startCanary('v2.0.0')
      const slots = service.getSlots()
      const canarySlot = slots.find(s => s.version === 'v2.0.0')!
      expect(canarySlot.trafficPercent).toBe(5) // default initial
    })

    it('advances canary traffic', () => {
      const record = service.startCanary('v2.0.0')!
      const result = service.advanceCanary(record.id)
      expect(result).not.toBeNull()
      expect(result!.newPercent).toBe(15) // 5 + 10 step
    })

    it('promotes canary at max percent', () => {
      service.setCanaryConfig({ initialPercent: 90, stepPercent: 20 })
      const record = service.startCanary('v2.0.0')!
      const result = service.advanceCanary(record.id)
      expect(result!.promoted).toBe(true)
      expect(service.getDeployment(record.id)!.status).toBe('completed')
    })

    it('records health checks', () => {
      const record = service.startCanary('v2.0.0')!
      service.recordHealthCheck(record.id, 'green', true, 50)
      service.recordHealthCheck(record.id, 'green', true, 45)
      expect(service.getDeployment(record.id)!.healthChecks.length).toBe(2)
    })

    it('detects auto-rollback condition', () => {
      service.setCanaryConfig({ failureThreshold: 2, autoRollback: true })
      const record = service.startCanary('v2.0.0')!
      service.recordHealthCheck(record.id, 'green', false, 500)
      service.recordHealthCheck(record.id, 'green', false, 600)
      expect(service.shouldAutoRollback(record.id)).toBe(true)
    })

    it('does not rollback when healthy', () => {
      const record = service.startCanary('v2.0.0')!
      service.recordHealthCheck(record.id, 'green', true, 50)
      service.recordHealthCheck(record.id, 'green', true, 45)
      expect(service.shouldAutoRollback(record.id)).toBe(false)
    })
  })

  describe('Configuration', () => {
    it('gets and sets canary config', () => {
      service.setCanaryConfig({ initialPercent: 10, stepPercent: 20 })
      const config = service.getCanaryConfig()
      expect(config.initialPercent).toBe(10)
      expect(config.stepPercent).toBe(20)
    })

    it('gets active deployment', () => {
      service.startCanary('v2.0.0')
      expect(service.getActiveDeployment()).toBeDefined()
    })

    it('counts deployments', () => {
      service.deployToStandby('v2.0.0')
      expect(service.deploymentCount).toBe(1)
    })
  })
})
