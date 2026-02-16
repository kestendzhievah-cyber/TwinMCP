/**
 * Circuit Breaker pattern for MCP tool execution.
 *
 * States:
 *   CLOSED   – requests flow normally; failures are counted.
 *   OPEN     – requests are immediately rejected; after `resetTimeout` the
 *              breaker moves to HALF_OPEN.
 *   HALF_OPEN – a single probe request is allowed through; success → CLOSED,
 *               failure → OPEN.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default 5) */
  failureThreshold?: number
  /** Milliseconds to wait in OPEN state before probing (default 30 000) */
  resetTimeout?: number
  /** Milliseconds after which a single failure record expires (default 60 000) */
  failureWindow?: number
  /** Maximum number of tracked breakers to prevent unbounded memory (default 500) */
  maxBreakers?: number
}

interface BreakerState {
  state: CircuitState
  failures: number
  lastFailureTime: number
  openedAt: number
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  failureWindow: 60_000,
  maxBreakers: 500,
}

export class CircuitBreakerRegistry {
  private breakers: Map<string, BreakerState> = new Map()
  private opts: Required<CircuitBreakerOptions>

  constructor(options: CircuitBreakerOptions = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Check whether a request for `key` is allowed.
   * Returns `true` if the request may proceed, `false` if the circuit is OPEN.
   */
  allowRequest(key: string): boolean {
    const breaker = this.getOrCreate(key)
    const now = Date.now()

    switch (breaker.state) {
      case 'CLOSED':
        return true

      case 'OPEN':
        if (now - breaker.openedAt >= this.opts.resetTimeout) {
          breaker.state = 'HALF_OPEN'
          return true // allow one probe
        }
        return false

      case 'HALF_OPEN':
        // Only one probe at a time – reject additional requests while probing
        return false
    }
  }

  /** Record a successful execution for `key`. */
  recordSuccess(key: string): void {
    const breaker = this.getOrCreate(key)
    breaker.failures = 0
    breaker.state = 'CLOSED'
  }

  /** Record a failed execution for `key`. */
  recordFailure(key: string): void {
    const breaker = this.getOrCreate(key)
    const now = Date.now()

    // Reset failure count if outside the failure window
    if (now - breaker.lastFailureTime > this.opts.failureWindow) {
      breaker.failures = 0
    }

    breaker.failures++
    breaker.lastFailureTime = now

    if (breaker.state === 'HALF_OPEN') {
      // Probe failed → reopen
      breaker.state = 'OPEN'
      breaker.openedAt = now
    } else if (breaker.failures >= this.opts.failureThreshold) {
      breaker.state = 'OPEN'
      breaker.openedAt = now
    }
  }

  /** Get the current state for `key`. */
  getState(key: string): CircuitState {
    return this.getOrCreate(key).state
  }

  /** Get stats for all tracked breakers. */
  getStats(): Array<{ key: string; state: CircuitState; failures: number }> {
    return Array.from(this.breakers.entries()).map(([key, b]) => ({
      key,
      state: b.state,
      failures: b.failures,
    }))
  }

  /** Reset a specific breaker. */
  reset(key: string): void {
    this.breakers.delete(key)
  }

  /** Reset all breakers. */
  resetAll(): void {
    this.breakers.clear()
  }

  private getOrCreate(key: string): BreakerState {
    let breaker = this.breakers.get(key)
    if (!breaker) {
      // Evict oldest if at capacity
      if (this.breakers.size >= this.opts.maxBreakers) {
        const oldest = this.breakers.keys().next().value
        if (oldest !== undefined) this.breakers.delete(oldest)
      }
      breaker = { state: 'CLOSED', failures: 0, lastFailureTime: 0, openedAt: 0 }
      this.breakers.set(key, breaker)
    }
    return breaker
  }
}

// Global singleton
let globalRegistry: CircuitBreakerRegistry | null = null

export function getCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreakerRegistry {
  if (!globalRegistry) {
    globalRegistry = new CircuitBreakerRegistry(options)
  }
  return globalRegistry
}
