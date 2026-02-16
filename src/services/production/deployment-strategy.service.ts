/**
 * Deployment Strategy Service.
 *
 * Blue-green and canary deployment management:
 *   - Blue-green slot management (active/standby)
 *   - Traffic switching
 *   - Canary rollout with percentage-based traffic split
 *   - Health checks before promotion
 *   - Automatic rollback on failure
 *   - Deployment history
 */

export interface DeploymentSlot {
  name: 'blue' | 'green'
  version: string
  status: 'active' | 'standby' | 'deploying' | 'draining'
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
  instances: number
  trafficPercent: number
  deployedAt: string
  url: string
}

export interface CanaryConfig {
  initialPercent: number
  stepPercent: number
  stepIntervalMinutes: number
  maxPercent: number
  healthCheckUrl: string
  successThreshold: number
  failureThreshold: number
  autoPromote: boolean
  autoRollback: boolean
}

export interface DeploymentRecord {
  id: string
  strategy: 'blue-green' | 'canary' | 'rolling'
  version: string
  previousVersion: string
  status: 'in_progress' | 'completed' | 'rolled_back' | 'failed'
  startedAt: string
  completedAt?: string
  trafficHistory: Array<{ timestamp: string; bluePercent: number; greenPercent: number }>
  healthChecks: Array<{ timestamp: string; slot: string; healthy: boolean; latencyMs: number }>
  rollbackReason?: string
}

const DEFAULT_CANARY: CanaryConfig = {
  initialPercent: 5,
  stepPercent: 10,
  stepIntervalMinutes: 15,
  maxPercent: 100,
  healthCheckUrl: '/health',
  successThreshold: 3,
  failureThreshold: 2,
  autoPromote: true,
  autoRollback: true,
}

export class DeploymentStrategyService {
  private slots: Map<string, DeploymentSlot> = new Map()
  private deployments: DeploymentRecord[] = []
  private canaryConfig: CanaryConfig = { ...DEFAULT_CANARY }
  private idCounter = 0

  constructor() {
    this.initializeSlots()
  }

  private initializeSlots(): void {
    this.slots.set('blue', {
      name: 'blue', version: 'v1.0.0', status: 'active', healthStatus: 'healthy',
      instances: 3, trafficPercent: 100, deployedAt: new Date().toISOString(), url: 'http://blue.internal',
    })
    this.slots.set('green', {
      name: 'green', version: 'v1.0.0', status: 'standby', healthStatus: 'unknown',
      instances: 0, trafficPercent: 0, deployedAt: new Date().toISOString(), url: 'http://green.internal',
    })
  }

  // ── Slot Management ────────────────────────────────────────

  getSlot(name: string): DeploymentSlot | undefined {
    return this.slots.get(name)
  }

  getSlots(): DeploymentSlot[] {
    return Array.from(this.slots.values())
  }

  getActiveSlot(): DeploymentSlot | undefined {
    return Array.from(this.slots.values()).find(s => s.status === 'active')
  }

  getStandbySlot(): DeploymentSlot | undefined {
    return Array.from(this.slots.values()).find(s => s.status === 'standby')
  }

  // ── Blue-Green Deployment ──────────────────────────────────

  /** Deploy a new version to the standby slot. */
  deployToStandby(version: string, instances: number = 3): DeploymentRecord | null {
    const standby = this.getStandbySlot()
    const active = this.getActiveSlot()
    if (!standby || !active) return null

    standby.version = version
    standby.status = 'deploying'
    standby.instances = instances
    standby.deployedAt = new Date().toISOString()
    standby.healthStatus = 'unknown'

    const record: DeploymentRecord = {
      id: `deploy-${++this.idCounter}`,
      strategy: 'blue-green', version, previousVersion: active.version,
      status: 'in_progress', startedAt: new Date().toISOString(),
      trafficHistory: [{ timestamp: new Date().toISOString(), bluePercent: active.name === 'blue' ? 100 : 0, greenPercent: active.name === 'green' ? 100 : 0 }],
      healthChecks: [],
    }
    this.deployments.push(record)

    // Simulate health check passing
    standby.healthStatus = 'healthy'
    standby.status = 'standby'

    record.healthChecks.push({ timestamp: new Date().toISOString(), slot: standby.name, healthy: true, latencyMs: 50 })
    return record
  }

  /** Switch traffic from active to standby (blue-green swap). */
  switchTraffic(deploymentId?: string): boolean {
    const active = this.getActiveSlot()
    const standby = this.getStandbySlot()
    if (!active || !standby) return false
    if (standby.healthStatus !== 'healthy') return false

    active.status = 'draining'
    active.trafficPercent = 0
    standby.status = 'active'
    standby.trafficPercent = 100

    // After drain, mark old as standby
    active.status = 'standby'
    active.instances = 0

    if (deploymentId) {
      const record = this.deployments.find(d => d.id === deploymentId)
      if (record) {
        record.status = 'completed'
        record.completedAt = new Date().toISOString()
        record.trafficHistory.push({
          timestamp: new Date().toISOString(),
          bluePercent: standby.name === 'blue' ? 100 : 0,
          greenPercent: standby.name === 'green' ? 100 : 0,
        })
      }
    }
    return true
  }

  /** Rollback: switch traffic back to the previous active slot. */
  rollback(deploymentId?: string, reason?: string): boolean {
    const active = this.getActiveSlot()
    const standby = this.getStandbySlot()
    if (!active || !standby) return false

    active.status = 'standby'
    active.trafficPercent = 0
    standby.status = 'active'
    standby.trafficPercent = 100

    if (deploymentId) {
      const record = this.deployments.find(d => d.id === deploymentId)
      if (record) {
        record.status = 'rolled_back'
        record.completedAt = new Date().toISOString()
        record.rollbackReason = reason || 'Manual rollback'
      }
    }
    return true
  }

  // ── Canary Deployment ──────────────────────────────────────

  getCanaryConfig(): CanaryConfig { return { ...this.canaryConfig } }
  setCanaryConfig(config: Partial<CanaryConfig>): void { Object.assign(this.canaryConfig, config) }

  /** Start a canary deployment. */
  startCanary(version: string): DeploymentRecord | null {
    const active = this.getActiveSlot()
    const standby = this.getStandbySlot()
    if (!active || !standby) return null

    standby.version = version
    standby.status = 'active'
    standby.healthStatus = 'healthy'
    standby.instances = 1
    standby.deployedAt = new Date().toISOString()

    const initialPercent = this.canaryConfig.initialPercent
    standby.trafficPercent = initialPercent
    active.trafficPercent = 100 - initialPercent

    const record: DeploymentRecord = {
      id: `deploy-${++this.idCounter}`,
      strategy: 'canary', version, previousVersion: active.version,
      status: 'in_progress', startedAt: new Date().toISOString(),
      trafficHistory: [{
        timestamp: new Date().toISOString(),
        bluePercent: active.name === 'blue' ? active.trafficPercent : standby.trafficPercent,
        greenPercent: active.name === 'green' ? active.trafficPercent : standby.trafficPercent,
      }],
      healthChecks: [],
    }
    this.deployments.push(record)
    return record
  }

  /** Advance canary traffic by one step. */
  advanceCanary(deploymentId: string): { newPercent: number; promoted: boolean } | null {
    const record = this.deployments.find(d => d.id === deploymentId)
    if (!record || record.status !== 'in_progress') return null

    const standby = Array.from(this.slots.values()).find(s => s.version === record.version)
    const active = Array.from(this.slots.values()).find(s => s.version === record.previousVersion)
    if (!standby || !active) return null

    const newPercent = Math.min(standby.trafficPercent + this.canaryConfig.stepPercent, this.canaryConfig.maxPercent)
    standby.trafficPercent = newPercent
    active.trafficPercent = 100 - newPercent

    record.trafficHistory.push({
      timestamp: new Date().toISOString(),
      bluePercent: this.slots.get('blue')!.trafficPercent,
      greenPercent: this.slots.get('green')!.trafficPercent,
    })

    const promoted = newPercent >= this.canaryConfig.maxPercent
    if (promoted) {
      standby.status = 'active'
      active.status = 'standby'
      active.trafficPercent = 0
      standby.trafficPercent = 100
      record.status = 'completed'
      record.completedAt = new Date().toISOString()
    }

    return { newPercent, promoted }
  }

  /** Record a health check for a canary deployment. */
  recordHealthCheck(deploymentId: string, slot: string, healthy: boolean, latencyMs: number): void {
    const record = this.deployments.find(d => d.id === deploymentId)
    if (record) {
      record.healthChecks.push({ timestamp: new Date().toISOString(), slot, healthy, latencyMs })
    }
  }

  /** Check if canary should be auto-rolled back based on health checks. */
  shouldAutoRollback(deploymentId: string): boolean {
    if (!this.canaryConfig.autoRollback) return false
    const record = this.deployments.find(d => d.id === deploymentId)
    if (!record) return false

    const recentChecks = record.healthChecks.slice(-this.canaryConfig.failureThreshold)
    const failures = recentChecks.filter(c => !c.healthy).length
    return failures >= this.canaryConfig.failureThreshold
  }

  // ── Deployment History ─────────────────────────────────────

  getDeployments(): DeploymentRecord[] {
    return [...this.deployments].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }

  getDeployment(id: string): DeploymentRecord | undefined {
    return this.deployments.find(d => d.id === id)
  }

  getActiveDeployment(): DeploymentRecord | undefined {
    return this.deployments.find(d => d.status === 'in_progress')
  }

  get deploymentCount(): number { return this.deployments.length }
}

export const deploymentStrategyService = new DeploymentStrategyService()
