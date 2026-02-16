/**
 * Application-level Load Balancer for MCP.
 *
 * Supports multiple strategies:
 *   - round-robin: simple rotation
 *   - weighted-round-robin: rotation weighted by capacity
 *   - least-connections: route to the backend with fewest active requests
 *   - random: random selection
 *
 * Includes health checking and automatic removal of unhealthy backends.
 */

export interface Backend {
  id: string
  url: string
  weight: number
  healthy: boolean
  activeConnections: number
  totalRequests: number
  totalErrors: number
  lastHealthCheck?: Date
  metadata?: Record<string, any>
}

export type LBStrategy = 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'random'

export interface LoadBalancerConfig {
  strategy: LBStrategy
  healthCheckInterval?: number // ms, default 30_000
  healthCheckTimeout?: number  // ms, default 5_000
  maxRetries?: number          // default 2
  unhealthyThreshold?: number  // consecutive failures before marking unhealthy, default 3
}

export class LoadBalancer {
  private backends: Map<string, Backend> = new Map()
  private config: Required<LoadBalancerConfig>
  private roundRobinIndex = 0
  private weightedPool: string[] = []
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: LoadBalancerConfig) {
    this.config = {
      strategy: config.strategy,
      healthCheckInterval: config.healthCheckInterval ?? 30_000,
      healthCheckTimeout: config.healthCheckTimeout ?? 5_000,
      maxRetries: config.maxRetries ?? 2,
      unhealthyThreshold: config.unhealthyThreshold ?? 3,
    }
  }

  /** Add a backend to the pool. */
  addBackend(id: string, url: string, weight: number = 1): void {
    this.backends.set(id, {
      id,
      url,
      weight,
      healthy: true,
      activeConnections: 0,
      totalRequests: 0,
      totalErrors: 0,
    })
    this.rebuildWeightedPool()
  }

  /** Remove a backend from the pool. */
  removeBackend(id: string): boolean {
    const removed = this.backends.delete(id)
    if (removed) this.rebuildWeightedPool()
    return removed
  }

  /** Select the next backend based on the configured strategy. */
  selectBackend(): Backend | null {
    const healthy = this.getHealthyBackends()
    if (healthy.length === 0) return null

    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobin(healthy)
      case 'weighted-round-robin':
        return this.weightedRoundRobin()
      case 'least-connections':
        return this.leastConnections(healthy)
      case 'random':
        return healthy[Math.floor(Math.random() * healthy.length)]
    }
  }

  /** Record the start of a request to a backend. */
  recordRequestStart(backendId: string): void {
    const backend = this.backends.get(backendId)
    if (backend) {
      backend.activeConnections++
      backend.totalRequests++
    }
  }

  /** Record the end of a request (success). */
  recordRequestEnd(backendId: string): void {
    const backend = this.backends.get(backendId)
    if (backend && backend.activeConnections > 0) {
      backend.activeConnections--
    }
  }

  /** Record a failed request. */
  recordRequestError(backendId: string): void {
    const backend = this.backends.get(backendId)
    if (backend) {
      if (backend.activeConnections > 0) backend.activeConnections--
      backend.totalErrors++

      // Mark unhealthy after threshold
      const errorRate = backend.totalRequests > 0
        ? backend.totalErrors / backend.totalRequests
        : 0
      if (backend.totalErrors >= this.config.unhealthyThreshold && errorRate > 0.5) {
        backend.healthy = false
      }
    }
  }

  /** Mark a backend as healthy or unhealthy. */
  setHealth(backendId: string, healthy: boolean): void {
    const backend = this.backends.get(backendId)
    if (backend) {
      backend.healthy = healthy
      backend.lastHealthCheck = new Date()
      if (healthy) {
        backend.totalErrors = 0
      }
    }
  }

  /** Get all backends. */
  getBackends(): Backend[] {
    return Array.from(this.backends.values())
  }

  /** Get healthy backends only. */
  getHealthyBackends(): Backend[] {
    return Array.from(this.backends.values()).filter(b => b.healthy)
  }

  /** Get load balancer stats. */
  getStats(): {
    strategy: LBStrategy
    totalBackends: number
    healthyBackends: number
    totalRequests: number
    totalErrors: number
  } {
    const backends = Array.from(this.backends.values())
    return {
      strategy: this.config.strategy,
      totalBackends: backends.length,
      healthyBackends: backends.filter(b => b.healthy).length,
      totalRequests: backends.reduce((sum, b) => sum + b.totalRequests, 0),
      totalErrors: backends.reduce((sum, b) => sum + b.totalErrors, 0),
    }
  }

  /** Start periodic health checks. Provide a checker function. */
  startHealthChecks(checker: (backend: Backend) => Promise<boolean>): void {
    this.stopHealthChecks()
    this.healthCheckTimer = setInterval(async () => {
      for (const backend of this.backends.values()) {
        try {
          const healthy = await Promise.race([
            checker(backend),
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
            ),
          ])
          this.setHealth(backend.id, healthy)
        } catch {
          this.setHealth(backend.id, false)
        }
      }
    }, this.config.healthCheckInterval)
    if (this.healthCheckTimer.unref) this.healthCheckTimer.unref()
  }

  /** Stop health checks. */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /** Destroy the load balancer. */
  destroy(): void {
    this.stopHealthChecks()
    this.backends.clear()
    this.weightedPool = []
  }

  // ── Strategies ─────────────────────────────────────────────

  private roundRobin(healthy: Backend[]): Backend {
    this.roundRobinIndex = this.roundRobinIndex % healthy.length
    const backend = healthy[this.roundRobinIndex]
    this.roundRobinIndex++
    return backend
  }

  private weightedRoundRobin(): Backend | null {
    const healthyPool = this.weightedPool.filter(id => {
      const b = this.backends.get(id)
      return b && b.healthy
    })
    if (healthyPool.length === 0) return null

    this.roundRobinIndex = this.roundRobinIndex % healthyPool.length
    const id = healthyPool[this.roundRobinIndex]
    this.roundRobinIndex++
    return this.backends.get(id) || null
  }

  private leastConnections(healthy: Backend[]): Backend {
    return healthy.reduce((min, b) =>
      b.activeConnections < min.activeConnections ? b : min
    )
  }

  private rebuildWeightedPool(): void {
    this.weightedPool = []
    for (const backend of this.backends.values()) {
      for (let i = 0; i < backend.weight; i++) {
        this.weightedPool.push(backend.id)
      }
    }
  }
}
