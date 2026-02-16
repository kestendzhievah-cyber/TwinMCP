/**
 * Vector Sharding Service.
 *
 * Distributes vector embeddings across multiple shards for horizontal
 * scalability. Supports consistent hashing, shard rebalancing, and
 * cross-shard search with result merging.
 *
 * Strategies:
 *   - hash: consistent hashing by document/library ID
 *   - range: range-based partitioning by ID prefix
 *   - round-robin: even distribution across shards
 */

export interface ShardConfig {
  id: string
  name: string
  capacity: number
  currentSize: number
  status: 'active' | 'draining' | 'offline'
  metadata?: Record<string, any>
}

export interface ShardedVector {
  id: string
  shardId: string
  vector: number[]
  metadata: Record<string, any>
}

export interface ShardStats {
  shardId: string
  vectorCount: number
  capacityUsed: number
  status: string
}

export type ShardStrategy = 'hash' | 'range' | 'round-robin'

export class VectorShardingService {
  private shards: Map<string, ShardConfig> = new Map()
  private vectors: Map<string, ShardedVector[]> = new Map() // shardId → vectors
  private strategy: ShardStrategy = 'hash'
  private roundRobinIndex = 0

  constructor(strategy: ShardStrategy = 'hash') {
    this.strategy = strategy
  }

  /** Set the sharding strategy. */
  setStrategy(strategy: ShardStrategy): void {
    this.strategy = strategy
  }

  /** Get the current strategy. */
  getStrategy(): ShardStrategy {
    return this.strategy
  }

  // ── Shard Management ───────────────────────────────────────

  /** Add a shard. */
  addShard(config: ShardConfig): void {
    this.shards.set(config.id, config)
    if (!this.vectors.has(config.id)) {
      this.vectors.set(config.id, [])
    }
  }

  /** Remove a shard (must be drained first). */
  removeShard(id: string): boolean {
    const shard = this.shards.get(id)
    if (!shard) return false
    if ((this.vectors.get(id)?.length || 0) > 0) return false // not empty
    this.shards.delete(id)
    this.vectors.delete(id)
    return true
  }

  /** Get a shard config. */
  getShard(id: string): ShardConfig | undefined {
    return this.shards.get(id)
  }

  /** List all shards. */
  getShards(): ShardConfig[] {
    return Array.from(this.shards.values())
  }

  /** Get active shards. */
  getActiveShards(): ShardConfig[] {
    return this.getShards().filter(s => s.status === 'active')
  }

  // ── Vector Operations ──────────────────────────────────────

  /** Insert a vector into the appropriate shard. */
  insert(id: string, vector: number[], metadata: Record<string, any> = {}): ShardedVector | null {
    const shardId = this.selectShard(id)
    if (!shardId) return null

    const shard = this.shards.get(shardId)!
    const shardVectors = this.vectors.get(shardId)!

    if (shard.currentSize >= shard.capacity) return null

    const entry: ShardedVector = { id, shardId, vector, metadata }
    shardVectors.push(entry)
    shard.currentSize = shardVectors.length

    return entry
  }

  /** Remove a vector by ID (searches all shards). */
  remove(id: string): boolean {
    for (const [shardId, vecs] of this.vectors) {
      const idx = vecs.findIndex(v => v.id === id)
      if (idx !== -1) {
        vecs.splice(idx, 1)
        const shard = this.shards.get(shardId)
        if (shard) shard.currentSize = vecs.length
        return true
      }
    }
    return false
  }

  /** Get a vector by ID. */
  get(id: string): ShardedVector | undefined {
    for (const vecs of this.vectors.values()) {
      const found = vecs.find(v => v.id === id)
      if (found) return found
    }
    return undefined
  }

  /** Search across all active shards by cosine similarity. */
  search(queryVector: number[], limit: number = 10, minScore: number = 0): Array<{ vector: ShardedVector; score: number }> {
    const results: Array<{ vector: ShardedVector; score: number }> = []

    for (const [shardId, vecs] of this.vectors) {
      const shard = this.shards.get(shardId)
      if (!shard || shard.status === 'offline') continue

      for (const vec of vecs) {
        const score = this.cosineSimilarity(queryVector, vec.vector)
        if (score >= minScore) {
          results.push({ vector: vec, score })
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /** Get total vector count across all shards. */
  get totalVectors(): number {
    let count = 0
    for (const vecs of this.vectors.values()) count += vecs.length
    return count
  }

  /** Get per-shard statistics. */
  getShardStats(): ShardStats[] {
    return this.getShards().map(s => ({
      shardId: s.id,
      vectorCount: this.vectors.get(s.id)?.length || 0,
      capacityUsed: s.capacity > 0 ? (this.vectors.get(s.id)?.length || 0) / s.capacity : 0,
      status: s.status,
    }))
  }

  /**
   * Rebalance vectors across shards (redistribute evenly).
   */
  rebalance(): { moved: number } {
    const allVectors: ShardedVector[] = []
    for (const vecs of this.vectors.values()) {
      allVectors.push(...vecs)
    }

    // Clear all shards
    for (const [shardId] of this.vectors) {
      this.vectors.set(shardId, [])
      const shard = this.shards.get(shardId)
      if (shard) shard.currentSize = 0
    }

    // Re-insert using current strategy
    let moved = 0
    for (const vec of allVectors) {
      const result = this.insert(vec.id, vec.vector, vec.metadata)
      if (result && result.shardId !== vec.shardId) moved++
    }

    return { moved }
  }

  /**
   * Drain a shard: move all its vectors to other active shards.
   */
  drainShard(shardId: string): { moved: number; failed: number } {
    const shard = this.shards.get(shardId)
    if (!shard) return { moved: 0, failed: 0 }

    shard.status = 'draining'
    const vecs = this.vectors.get(shardId) || []
    let moved = 0
    let failed = 0

    for (const vec of [...vecs]) {
      // Find another shard
      const otherShards = this.getActiveShards().filter(s => s.id !== shardId)
      let placed = false

      for (const other of otherShards) {
        if (other.currentSize < other.capacity) {
          const otherVecs = this.vectors.get(other.id)!
          otherVecs.push({ ...vec, shardId: other.id })
          other.currentSize = otherVecs.length
          placed = true
          moved++
          break
        }
      }

      if (!placed) failed++
    }

    // Clear drained shard
    this.vectors.set(shardId, [])
    shard.currentSize = 0

    return { moved, failed }
  }

  // ── Shard Selection ────────────────────────────────────────

  private selectShard(id: string): string | null {
    const active = this.getActiveShards().filter(s => s.currentSize < s.capacity)
    if (active.length === 0) return null

    switch (this.strategy) {
      case 'hash':
        return this.hashSelect(id, active)
      case 'range':
        return this.rangeSelect(id, active)
      case 'round-robin':
        return this.roundRobinSelect(active)
      default:
        return active[0].id
    }
  }

  private hashSelect(id: string, shards: ShardConfig[]): string {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
    }
    const idx = Math.abs(hash) % shards.length
    return shards[idx].id
  }

  private rangeSelect(id: string, shards: ShardConfig[]): string {
    const firstChar = id.charCodeAt(0) || 0
    const idx = firstChar % shards.length
    return shards[idx].id
  }

  private roundRobinSelect(shards: ShardConfig[]): string {
    const idx = this.roundRobinIndex % shards.length
    this.roundRobinIndex++
    return shards[idx].id
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }
}

export const vectorShardingService = new VectorShardingService()
