import { LoadBalancer } from '../../../lib/mcp/middleware/load-balancer'

describe('LoadBalancer', () => {
  describe('Round Robin', () => {
    let lb: LoadBalancer

    beforeEach(() => {
      lb = new LoadBalancer({ strategy: 'round-robin' })
      lb.addBackend('a', 'http://a:3000')
      lb.addBackend('b', 'http://b:3000')
      lb.addBackend('c', 'http://c:3000')
    })

    afterEach(() => lb.destroy())

    it('cycles through backends in order', () => {
      expect(lb.selectBackend()?.id).toBe('a')
      expect(lb.selectBackend()?.id).toBe('b')
      expect(lb.selectBackend()?.id).toBe('c')
      expect(lb.selectBackend()?.id).toBe('a')
    })

    it('skips unhealthy backends', () => {
      lb.setHealth('b', false)
      expect(lb.selectBackend()?.id).toBe('a')
      expect(lb.selectBackend()?.id).toBe('c')
      expect(lb.selectBackend()?.id).toBe('a')
    })

    it('returns null when all backends are unhealthy', () => {
      lb.setHealth('a', false)
      lb.setHealth('b', false)
      lb.setHealth('c', false)
      expect(lb.selectBackend()).toBeNull()
    })
  })

  describe('Weighted Round Robin', () => {
    let lb: LoadBalancer

    beforeEach(() => {
      lb = new LoadBalancer({ strategy: 'weighted-round-robin' })
      lb.addBackend('heavy', 'http://heavy:3000', 3)
      lb.addBackend('light', 'http://light:3000', 1)
    })

    afterEach(() => lb.destroy())

    it('selects heavier backend more often', () => {
      const counts: Record<string, number> = { heavy: 0, light: 0 }
      for (let i = 0; i < 8; i++) {
        const b = lb.selectBackend()
        if (b) counts[b.id]++
      }
      expect(counts.heavy).toBeGreaterThan(counts.light)
    })
  })

  describe('Least Connections', () => {
    let lb: LoadBalancer

    beforeEach(() => {
      lb = new LoadBalancer({ strategy: 'least-connections' })
      lb.addBackend('a', 'http://a:3000')
      lb.addBackend('b', 'http://b:3000')
    })

    afterEach(() => lb.destroy())

    it('selects backend with fewer active connections', () => {
      lb.recordRequestStart('a')
      lb.recordRequestStart('a')
      lb.recordRequestStart('b')

      expect(lb.selectBackend()?.id).toBe('b')
    })

    it('rebalances after request ends', () => {
      lb.recordRequestStart('a')
      lb.recordRequestStart('b')
      lb.recordRequestStart('b')
      lb.recordRequestEnd('b')

      // a=1, b=1 — either is valid, but least-connections picks first tie
      const selected = lb.selectBackend()
      expect(['a', 'b']).toContain(selected?.id)
    })
  })

  describe('Random', () => {
    it('selects a backend', () => {
      const lb = new LoadBalancer({ strategy: 'random' })
      lb.addBackend('a', 'http://a:3000')
      lb.addBackend('b', 'http://b:3000')

      const selected = lb.selectBackend()
      expect(selected).not.toBeNull()
      expect(['a', 'b']).toContain(selected?.id)
      lb.destroy()
    })
  })

  describe('Backend management', () => {
    let lb: LoadBalancer

    beforeEach(() => {
      lb = new LoadBalancer({ strategy: 'round-robin' })
    })

    afterEach(() => lb.destroy())

    it('addBackend and removeBackend', () => {
      lb.addBackend('a', 'http://a:3000')
      expect(lb.getBackends().length).toBe(1)
      lb.removeBackend('a')
      expect(lb.getBackends().length).toBe(0)
    })

    it('recordRequestError marks backend unhealthy after threshold', () => {
      const lb2 = new LoadBalancer({ strategy: 'round-robin', unhealthyThreshold: 2 })
      lb2.addBackend('a', 'http://a:3000')

      lb2.recordRequestStart('a')
      lb2.recordRequestError('a')
      lb2.recordRequestStart('a')
      lb2.recordRequestError('a')

      const backend = lb2.getBackends().find(b => b.id === 'a')
      expect(backend?.healthy).toBe(false)
      lb2.destroy()
    })

    it('getStats returns correct counts', () => {
      lb.addBackend('a', 'http://a:3000')
      lb.addBackend('b', 'http://b:3000')
      lb.setHealth('b', false)

      const stats = lb.getStats()
      expect(stats.totalBackends).toBe(2)
      expect(stats.healthyBackends).toBe(1)
      expect(stats.strategy).toBe('round-robin')
    })
  })
})
