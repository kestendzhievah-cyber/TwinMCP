/**
 * Database Sharding Service.
 *
 * Manages horizontal database partitioning:
 *   - Shard key configuration
 *   - Consistent hashing for shard assignment
 *   - Shard routing (read/write)
 *   - Rebalancing support
 *   - Cross-shard query coordination
 *   - Shard health monitoring
 */

export interface ShardConfig {
  id: string
  name: string
  host: string
  port: number
  database: string
  weight: number
  status: 'active' | 'readonly' | 'draining' | 'offline'
  region?: string
  maxConnections: number
  currentConnections: number
}

export interface ShardingStrategy {
  type: 'hash' | 'range' | 'directory'
  shardKey: string
  totalShards: number
}

export interface ShardAssignment {
  key: string
  shardId: string
  assignedAt: string
}

export interface RebalanceOperation {
  id: string
  fromShard: string
  toShard: string
  keysToMove: number
  keysMoved: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
}

export interface CrossShardQuery {
  id: string
  query: string
  targetShards: string[]
  results: Array<{ shardId: string; rowCount: number; durationMs: number }>
  totalRows: number
  totalDurationMs: number
  status: 'completed' | 'partial' | 'failed'
}

export class DatabaseShardingService {
  private shards: Map<string, ShardConfig> = new Map()
  private strategy: ShardingStrategy = { type: 'hash', shardKey: 'tenant_id', totalShards: 4 }
  private assignments: Map<string, string> = new Map() // key -> shardId
  private rebalanceOps: RebalanceOperation[] = []
  private queries: CrossShardQuery[] = []
  private idCounter = 0

  // ── Shard Management ───────────────────────────────────────

  addShard(name: string, host: string, port: number, database: string, options: Partial<ShardConfig> = {}): ShardConfig {
    const shard: ShardConfig = {
      id: `shard-${++this.idCounter}`, name, host, port, database,
      weight: options.weight || 1, status: 'active',
      region: options.region, maxConnections: options.maxConnections || 100,
      currentConnections: 0,
    }
    this.shards.set(shard.id, shard)
    return shard
  }

  getShard(id: string): ShardConfig | undefined { return this.shards.get(id) }
  getShards(): ShardConfig[] { return Array.from(this.shards.values()) }
  getActiveShards(): ShardConfig[] { return this.getShards().filter(s => s.status === 'active') }

  setShardStatus(id: string, status: ShardConfig['status']): boolean {
    const shard = this.shards.get(id)
    if (!shard) return false
    shard.status = status
    return true
  }

  removeShard(id: string): boolean { return this.shards.delete(id) }

  // ── Strategy Configuration ─────────────────────────────────

  setStrategy(strategy: ShardingStrategy): void { this.strategy = strategy }
  getStrategy(): ShardingStrategy { return { ...this.strategy } }

  // ── Shard Routing ──────────────────────────────────────────

  /** Determine which shard a key belongs to. */
  getShardForKey(key: string): ShardConfig | null {
    // Check directory first
    const assigned = this.assignments.get(key)
    if (assigned) {
      const shard = this.shards.get(assigned)
      if (shard && shard.status === 'active') return shard
    }

    const activeShards = this.getActiveShards()
    if (activeShards.length === 0) return null

    if (this.strategy.type === 'hash') {
      const hash = this.hashKey(key)
      const index = hash % activeShards.length
      const shard = activeShards[index]
      this.assignments.set(key, shard.id)
      return shard
    }

    if (this.strategy.type === 'range') {
      const firstChar = key.charCodeAt(0)
      const rangeSize = Math.ceil(256 / activeShards.length)
      const index = Math.min(Math.floor(firstChar / rangeSize), activeShards.length - 1)
      const shard = activeShards[index]
      this.assignments.set(key, shard.id)
      return shard
    }

    // Directory-based: use existing assignment or round-robin
    const index = this.assignments.size % activeShards.length
    const shard = activeShards[index]
    this.assignments.set(key, shard.id)
    return shard
  }

  /** Get the shard for read operations (may route to replicas). */
  getReadShard(key: string): ShardConfig | null {
    const shard = this.getShardForKey(key)
    if (!shard) return null
    // For readonly shards, still allow reads
    if (shard.status === 'readonly' || shard.status === 'active') return shard
    return null
  }

  /** Get the shard for write operations (active only). */
  getWriteShard(key: string): ShardConfig | null {
    const shard = this.getShardForKey(key)
    if (!shard || shard.status !== 'active') return null
    return shard
  }

  getAssignment(key: string): string | undefined { return this.assignments.get(key) }
  get assignmentCount(): number { return this.assignments.size }

  // ── Rebalancing ────────────────────────────────────────────

  /** Plan a rebalance operation between two shards. */
  planRebalance(fromShardId: string, toShardId: string, keysToMove: number): RebalanceOperation | null {
    const from = this.shards.get(fromShardId)
    const to = this.shards.get(toShardId)
    if (!from || !to) return null

    const op: RebalanceOperation = {
      id: `rebal-${++this.idCounter}`,
      fromShard: fromShardId, toShard: toShardId,
      keysToMove, keysMoved: 0,
      status: 'pending', startedAt: new Date().toISOString(),
    }
    this.rebalanceOps.push(op)
    return op
  }

  /** Execute a rebalance operation (moves keys in assignments). */
  executeRebalance(operationId: string): boolean {
    const op = this.rebalanceOps.find(o => o.id === operationId)
    if (!op || op.status !== 'pending') return false

    op.status = 'in_progress'
    let moved = 0
    for (const [key, shardId] of this.assignments) {
      if (shardId === op.fromShard && moved < op.keysToMove) {
        this.assignments.set(key, op.toShard)
        moved++
      }
    }

    op.keysMoved = moved
    op.status = 'completed'
    op.completedAt = new Date().toISOString()
    return true
  }

  getRebalanceOps(): RebalanceOperation[] { return [...this.rebalanceOps] }

  // ── Cross-Shard Queries ────────────────────────────────────

  /** Simulate a cross-shard query. */
  executeCrossShardQuery(query: string, targetShardIds?: string[]): CrossShardQuery {
    const targets = targetShardIds || this.getActiveShards().map(s => s.id)
    const results = targets.map(shardId => ({
      shardId,
      rowCount: Math.floor(Math.random() * 100),
      durationMs: Math.floor(20 + Math.random() * 80),
    }))

    const q: CrossShardQuery = {
      id: `csq-${++this.idCounter}`, query, targetShards: targets,
      results, totalRows: results.reduce((s, r) => s + r.rowCount, 0),
      totalDurationMs: Math.max(...results.map(r => r.durationMs)),
      status: results.length === targets.length ? 'completed' : 'partial',
    }
    this.queries.push(q)
    return q
  }

  getCrossShardQueries(): CrossShardQuery[] { return [...this.queries] }

  // ── Health Monitoring ──────────────────────────────────────

  getShardHealth(): Array<{ shardId: string; name: string; status: string; connectionUsage: number; healthy: boolean }> {
    return this.getShards().map(s => ({
      shardId: s.id, name: s.name, status: s.status,
      connectionUsage: s.maxConnections > 0 ? s.currentConnections / s.maxConnections : 0,
      healthy: s.status === 'active' && s.currentConnections < s.maxConnections * 0.9,
    }))
  }

  // ── Internal ───────────────────────────────────────────────

  private hashKey(key: string): number {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }
}

export const databaseShardingService = new DatabaseShardingService()
