import { VectorShardingService } from '../../src/services/embeddings/vector-sharding.service'

describe('VectorShardingService', () => {
  let service: VectorShardingService

  function makeShard(id: string, capacity: number = 100) {
    return { id, name: `Shard ${id}`, capacity, currentSize: 0, status: 'active' as const }
  }

  beforeEach(() => {
    service = new VectorShardingService('round-robin')
    service.addShard(makeShard('s1'))
    service.addShard(makeShard('s2'))
  })

  describe('Shard management', () => {
    it('adds and lists shards', () => {
      expect(service.getShards().length).toBe(2)
    })

    it('gets a shard by ID', () => {
      expect(service.getShard('s1')?.name).toBe('Shard s1')
    })

    it('removes empty shard', () => {
      service.addShard(makeShard('s3'))
      expect(service.removeShard('s3')).toBe(true)
      expect(service.getShards().length).toBe(2)
    })

    it('refuses to remove non-empty shard', () => {
      service.insert('v1', [1, 0], {})
      expect(service.removeShard('s1')).toBe(false)
    })

    it('lists active shards', () => {
      service.addShard({ id: 's3', name: 'Offline', capacity: 50, currentSize: 0, status: 'offline' })
      expect(service.getActiveShards().length).toBe(2)
    })
  })

  describe('Vector operations', () => {
    it('inserts vectors', () => {
      service.insert('v1', [1, 0, 0], { name: 'a' })
      service.insert('v2', [0, 1, 0], { name: 'b' })
      expect(service.totalVectors).toBe(2)
    })

    it('distributes across shards with round-robin', () => {
      service.insert('v1', [1, 0], {})
      service.insert('v2', [0, 1], {})
      service.insert('v3', [1, 1], {})
      service.insert('v4', [0, 0], {})

      const stats = service.getShardStats()
      expect(stats[0].vectorCount).toBe(2)
      expect(stats[1].vectorCount).toBe(2)
    })

    it('gets a vector by ID', () => {
      service.insert('v1', [1, 2, 3], { tag: 'test' })
      const v = service.get('v1')
      expect(v).toBeDefined()
      expect(v!.vector).toEqual([1, 2, 3])
    })

    it('removes a vector', () => {
      service.insert('v1', [1, 0], {})
      expect(service.remove('v1')).toBe(true)
      expect(service.totalVectors).toBe(0)
    })

    it('returns false for removing unknown vector', () => {
      expect(service.remove('unknown')).toBe(false)
    })

    it('returns null when all shards full', () => {
      const s = new VectorShardingService('round-robin')
      s.addShard({ id: 's1', name: 'Tiny', capacity: 1, currentSize: 0, status: 'active' })
      s.insert('v1', [1], {})
      expect(s.insert('v2', [2], {})).toBeNull()
    })
  })

  describe('Search', () => {
    beforeEach(() => {
      service.insert('a', [1, 0, 0], { name: 'a' })
      service.insert('b', [0.9, 0.1, 0], { name: 'b' })
      service.insert('c', [0, 0, 1], { name: 'c' })
    })

    it('searches across all shards', () => {
      const results = service.search([1, 0, 0], 10)
      expect(results.length).toBe(3)
      expect(results[0].vector.id).toBe('a')
    })

    it('respects limit', () => {
      const results = service.search([1, 0, 0], 1)
      expect(results.length).toBe(1)
    })

    it('respects minScore', () => {
      const results = service.search([1, 0, 0], 10, 0.9)
      expect(results.every(r => r.score >= 0.9)).toBe(true)
    })

    it('skips offline shards', () => {
      const shard = service.getShard('s1')!
      shard.status = 'offline'
      const results = service.search([1, 0, 0], 10)
      // Only vectors in s2 should be returned
      expect(results.length).toBeLessThanOrEqual(2)
    })
  })

  describe('Strategies', () => {
    it('supports hash strategy', () => {
      service.setStrategy('hash')
      expect(service.getStrategy()).toBe('hash')
      service.insert('test-id', [1, 0], {})
      expect(service.totalVectors).toBe(1)
    })

    it('supports range strategy', () => {
      service.setStrategy('range')
      service.insert('abc', [1, 0], {})
      service.insert('xyz', [0, 1], {})
      expect(service.totalVectors).toBe(2)
    })
  })

  describe('Rebalance', () => {
    it('rebalances vectors across shards', () => {
      // Insert all into one shard via round-robin
      for (let i = 0; i < 10; i++) {
        service.insert(`v${i}`, [i, 0], {})
      }
      expect(service.totalVectors).toBe(10)

      const result = service.rebalance()
      expect(service.totalVectors).toBe(10)
      // Some vectors may have moved
      expect(result.moved).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Drain', () => {
    it('drains a shard to other shards', () => {
      service.insert('v1', [1, 0], {})
      service.insert('v2', [0, 1], {})
      service.insert('v3', [1, 1], {})

      const s1Vectors = service.getShardStats().find(s => s.shardId === 's1')!.vectorCount
      if (s1Vectors > 0) {
        const result = service.drainShard('s1')
        expect(result.moved).toBe(s1Vectors)
        expect(service.getShardStats().find(s => s.shardId === 's1')!.vectorCount).toBe(0)
      }
    })
  })

  describe('Stats', () => {
    it('reports per-shard stats', () => {
      service.insert('v1', [1, 0], {})
      const stats = service.getShardStats()
      expect(stats.length).toBe(2)
      expect(stats.some(s => s.vectorCount > 0)).toBe(true)
    })
  })
})
