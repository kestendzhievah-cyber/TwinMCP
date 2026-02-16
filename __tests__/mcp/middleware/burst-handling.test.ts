import { RateLimiter } from '../../../lib/mcp/middleware/rate-limit'

describe('Burst Handling (Token Bucket)', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
  })

  afterEach(() => {
    limiter.destroy()
  })

  it('allows requests up to burst capacity', async () => {
    const config = { rate: 2, burstCapacity: 5 }

    for (let i = 0; i < 5; i++) {
      const result = await limiter.checkBurstLimit(`user-burst-${Date.now()}`, config)
      // Each unique key gets full burst capacity
      expect(result.allowed).toBe(true)
    }
  })

  it('rejects after burst capacity is exhausted', async () => {
    const config = { rate: 1, burstCapacity: 3 }
    const key = 'burst-exhaust'

    // Consume all 3 tokens
    for (let i = 0; i < 3; i++) {
      const r = await limiter.checkBurstLimit(key, config)
      expect(r.allowed).toBe(true)
    }

    // 4th should be rejected
    const r = await limiter.checkBurstLimit(key, config)
    expect(r.allowed).toBe(false)
    expect(r.tokensRemaining).toBe(0)
  })

  it('tokens refill over time', async () => {
    const config = { rate: 100, burstCapacity: 3 } // 100 tokens/sec refill

    const key = 'burst-refill'

    // Consume all tokens
    for (let i = 0; i < 3; i++) {
      await limiter.checkBurstLimit(key, config)
    }

    // Should be exhausted
    const r1 = await limiter.checkBurstLimit(key, config)
    expect(r1.allowed).toBe(false)

    // Wait for refill (100/sec = 1 token in 10ms)
    await new Promise(r => setTimeout(r, 50))

    // Should have tokens again
    const r2 = await limiter.checkBurstLimit(key, config)
    expect(r2.allowed).toBe(true)
  })

  it('checkCombinedLimit enforces both burst and sustained limits', async () => {
    const sustained = { requests: 100, period: '1m', strategy: 'sliding' as const }
    const burst = { rate: 1, burstCapacity: 2 }
    const key = 'combined'

    // First 2 should pass (within burst)
    const r1 = await limiter.checkCombinedLimit(key, sustained, burst)
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.checkCombinedLimit(key, sustained, burst)
    expect(r2.allowed).toBe(true)

    // 3rd should fail on burst
    const r3 = await limiter.checkCombinedLimit(key, sustained, burst)
    expect(r3.allowed).toBe(false)
    expect(r3.reason).toContain('Burst')
  })

  it('getStats includes burstBuckets count', () => {
    const stats = limiter.getStats()
    expect(stats).toHaveProperty('burstBuckets')
    expect(typeof stats.burstBuckets).toBe('number')
  })
})
