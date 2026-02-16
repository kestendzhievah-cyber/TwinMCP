import { CircuitBreakerRegistry } from '../../../lib/mcp/core/circuit-breaker'

describe('CircuitBreakerRegistry', () => {
  let cb: CircuitBreakerRegistry

  beforeEach(() => {
    cb = new CircuitBreakerRegistry({
      failureThreshold: 3,
      resetTimeout: 100,
      failureWindow: 500,
    })
  })

  it('starts in CLOSED state and allows requests', () => {
    expect(cb.getState('tool-a')).toBe('CLOSED')
    expect(cb.allowRequest('tool-a')).toBe(true)
  })

  it('stays CLOSED when failures are below threshold', () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    expect(cb.getState('tool-a')).toBe('CLOSED')
    expect(cb.allowRequest('tool-a')).toBe(true)
  })

  it('opens after reaching failure threshold', () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    expect(cb.getState('tool-a')).toBe('OPEN')
    expect(cb.allowRequest('tool-a')).toBe(false)
  })

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    expect(cb.getState('tool-a')).toBe('OPEN')

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 120))

    // Should allow one probe request
    expect(cb.allowRequest('tool-a')).toBe(true)
    expect(cb.getState('tool-a')).toBe('HALF_OPEN')

    // Second request while probing should be rejected
    expect(cb.allowRequest('tool-a')).toBe(false)
  })

  it('closes again on success after HALF_OPEN', async () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')

    await new Promise(r => setTimeout(r, 120))
    cb.allowRequest('tool-a') // transition to HALF_OPEN

    cb.recordSuccess('tool-a')
    expect(cb.getState('tool-a')).toBe('CLOSED')
    expect(cb.allowRequest('tool-a')).toBe(true)
  })

  it('reopens on failure in HALF_OPEN', async () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')

    await new Promise(r => setTimeout(r, 120))
    cb.allowRequest('tool-a') // transition to HALF_OPEN

    cb.recordFailure('tool-a')
    expect(cb.getState('tool-a')).toBe('OPEN')
    expect(cb.allowRequest('tool-a')).toBe(false)
  })

  it('tracks separate breakers per key', () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')

    expect(cb.getState('tool-a')).toBe('OPEN')
    expect(cb.getState('tool-b')).toBe('CLOSED')
    expect(cb.allowRequest('tool-b')).toBe(true)
  })

  it('resets failure count after failureWindow expires', async () => {
    const shortWindow = new CircuitBreakerRegistry({
      failureThreshold: 3,
      resetTimeout: 100,
      failureWindow: 50,
    })

    shortWindow.recordFailure('tool-a')
    shortWindow.recordFailure('tool-a')

    // Wait for failure window to expire
    await new Promise(r => setTimeout(r, 60))

    // This failure should reset the counter (window expired), so only 1 failure now
    shortWindow.recordFailure('tool-a')
    expect(shortWindow.getState('tool-a')).toBe('CLOSED')
  })

  it('reset() clears a specific breaker', () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    expect(cb.getState('tool-a')).toBe('OPEN')

    cb.reset('tool-a')
    expect(cb.getState('tool-a')).toBe('CLOSED')
  })

  it('resetAll() clears all breakers', () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-b')
    cb.recordFailure('tool-b')
    cb.recordFailure('tool-b')

    cb.resetAll()
    expect(cb.getState('tool-a')).toBe('CLOSED')
    expect(cb.getState('tool-b')).toBe('CLOSED')
  })

  it('getStats() returns all tracked breakers', () => {
    cb.recordFailure('tool-a')
    cb.recordFailure('tool-b')
    cb.recordFailure('tool-b')
    cb.recordFailure('tool-b')

    const stats = cb.getStats()
    expect(stats).toHaveLength(2)
    expect(stats.find(s => s.key === 'tool-a')?.failures).toBe(1)
    expect(stats.find(s => s.key === 'tool-b')?.state).toBe('OPEN')
  })

  it('evicts oldest breaker when maxBreakers is reached', () => {
    const small = new CircuitBreakerRegistry({ maxBreakers: 2 })
    small.allowRequest('a')
    small.allowRequest('b')
    small.recordFailure('a') // 'a' has state
    small.allowRequest('c') // should evict 'a'

    const stats = small.getStats()
    const keys = stats.map(s => s.key)
    expect(keys).toContain('b')
    expect(keys).toContain('c')
    expect(keys).not.toContain('a')
  })
})
