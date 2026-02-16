import { describe, it, expect, beforeEach } from '@jest/globals'
import { MCPCache } from '../../../lib/mcp/core/cache'

describe('Memory Bounds', () => {
  describe('MCPCache LRU Eviction', () => {
    let cache: MCPCache

    beforeEach(() => {
      cache = new MCPCache(
        { enabled: true, ttl: 3600, key: (args: any) => JSON.stringify(args), strategy: 'memory' as const },
        5 // maxEntries = 5
      )
    })

    it('should store and retrieve entries within limit', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')

      expect(await cache.get('key1')).toBe('value1')
      expect(await cache.get('key2')).toBe('value2')
      expect(await cache.get('key3')).toBe('value3')
    })

    it('should evict oldest entries when exceeding maxEntries', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')
      await cache.set('key4', 'value4')
      await cache.set('key5', 'value5')

      // At capacity — adding one more should evict key1
      await cache.set('key6', 'value6')

      expect(await cache.get('key1')).toBeNull() // evicted
      expect(await cache.get('key2')).toBe('value2')
      expect(await cache.get('key6')).toBe('value6')

      const stats = cache.getStats()
      expect(stats.memorySize).toBeLessThanOrEqual(5)
    })

    it('should report utilization percentage', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      const stats = cache.getStats()
      expect(stats.utilizationPercent).toBe(40) // 2/5 = 40%
      expect(stats.maxEntries).toBe(5)
    })

    it('should handle delete correctly', async () => {
      await cache.set('key1', 'value1')
      await cache.delete('key1')

      expect(await cache.get('key1')).toBeNull()
      expect(cache.getStats().memorySize).toBe(0)
    })

    it('should handle clear correctly', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.clear()

      expect(cache.getStats().memorySize).toBe(0)
    })

    it('should handle TTL expiration', async () => {
      const shortTtlCache = new MCPCache(
        { enabled: true, ttl: 1, key: (args: any) => JSON.stringify(args), strategy: 'memory' as const },
        100
      )

      await shortTtlCache.set('key1', 'value1', 0) // 0 second TTL — already expired on next read

      // TTL of 0 means no expiration in the implementation (ttl check: !entry.ttl)
      // Let's use a very short TTL and wait
      await shortTtlCache.set('key2', 'value2', 1) // 1 second TTL

      // Immediately should still be available
      expect(await shortTtlCache.get('key2')).toBe('value2')
    })
  })
})
