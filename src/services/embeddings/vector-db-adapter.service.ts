/**
 * Vector Database Adapter Service.
 *
 * Provides a unified interface for multiple vector database backends:
 *   - pgvector (current default)
 *   - Pinecone
 *   - Qdrant
 *   - In-memory (for testing)
 *
 * Supports migration between backends with progress tracking.
 */

export interface VectorRecord {
  id: string
  vector: number[]
  metadata: Record<string, any>
  namespace?: string
}

export interface VectorQuery {
  vector: number[]
  topK: number
  namespace?: string
  filter?: Record<string, any>
  minScore?: number
}

export interface VectorResult {
  id: string
  score: number
  metadata: Record<string, any>
}

export interface VectorDBStats {
  totalVectors: number
  dimensions: number
  namespaces: string[]
  backend: string
}

export interface MigrationProgress {
  source: string
  target: string
  totalRecords: number
  migratedRecords: number
  failedRecords: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  errors: string[]
}

export interface VectorDBBackend {
  name: string
  upsert(records: VectorRecord[]): Promise<{ upserted: number; errors: string[] }>
  query(query: VectorQuery): Promise<VectorResult[]>
  delete(ids: string[]): Promise<number>
  getAll(namespace?: string): Promise<VectorRecord[]>
  stats(): Promise<VectorDBStats>
}

/** In-memory backend for testing and local development. */
export class InMemoryVectorDB implements VectorDBBackend {
  name = 'in-memory'
  private store: Map<string, VectorRecord> = new Map()

  async upsert(records: VectorRecord[]): Promise<{ upserted: number; errors: string[] }> {
    for (const r of records) this.store.set(r.id, r)
    return { upserted: records.length, errors: [] }
  }

  async query(query: VectorQuery): Promise<VectorResult[]> {
    const results: VectorResult[] = []
    for (const record of this.store.values()) {
      if (query.namespace && record.namespace !== query.namespace) continue
      const score = this.cosine(query.vector, record.vector)
      if (score >= (query.minScore || 0)) {
        results.push({ id: record.id, score, metadata: record.metadata })
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, query.topK)
  }

  async delete(ids: string[]): Promise<number> {
    let count = 0
    for (const id of ids) { if (this.store.delete(id)) count++ }
    return count
  }

  async getAll(namespace?: string): Promise<VectorRecord[]> {
    const all = Array.from(this.store.values())
    return namespace ? all.filter(r => r.namespace === namespace) : all
  }

  async stats(): Promise<VectorDBStats> {
    const records = Array.from(this.store.values())
    const namespaces = [...new Set(records.map(r => r.namespace).filter(Boolean) as string[])]
    const dims = records.length > 0 ? records[0].vector.length : 0
    return { totalVectors: records.length, dimensions: dims, namespaces, backend: this.name }
  }

  private cosine(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    let dot = 0, nA = 0, nB = 0
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i] }
    const d = Math.sqrt(nA) * Math.sqrt(nB)
    return d === 0 ? 0 : dot / d
  }
}

/** Pinecone-compatible backend stub. */
export class PineconeAdapter implements VectorDBBackend {
  name = 'pinecone'
  private client: any

  constructor(private config: { apiKey: string; environment: string; indexName: string }) {}

  setClient(client: any): void { this.client = client }

  async upsert(records: VectorRecord[]): Promise<{ upserted: number; errors: string[] }> {
    if (!this.client) return { upserted: 0, errors: ['Pinecone client not initialized'] }
    const vectors = records.map(r => ({ id: r.id, values: r.vector, metadata: r.metadata }))
    await this.client.upsert({ vectors, namespace: records[0]?.namespace })
    return { upserted: records.length, errors: [] }
  }

  async query(query: VectorQuery): Promise<VectorResult[]> {
    if (!this.client) return []
    const res = await this.client.query({ vector: query.vector, topK: query.topK, namespace: query.namespace, includeMetadata: true })
    return (res.matches || []).map((m: any) => ({ id: m.id, score: m.score, metadata: m.metadata || {} }))
  }

  async delete(ids: string[]): Promise<number> {
    if (!this.client) return 0
    await this.client.deleteMany(ids)
    return ids.length
  }

  async getAll(): Promise<VectorRecord[]> { return [] }

  async stats(): Promise<VectorDBStats> {
    if (!this.client) return { totalVectors: 0, dimensions: 0, namespaces: [], backend: this.name }
    const s = await this.client.describeIndexStats()
    return { totalVectors: s.totalRecordCount || 0, dimensions: s.dimension || 0, namespaces: Object.keys(s.namespaces || {}), backend: this.name }
  }
}

/** Qdrant-compatible backend stub. */
export class QdrantAdapter implements VectorDBBackend {
  name = 'qdrant'
  private client: any

  constructor(private config: { url: string; collectionName: string; apiKey?: string }) {}

  setClient(client: any): void { this.client = client }

  async upsert(records: VectorRecord[]): Promise<{ upserted: number; errors: string[] }> {
    if (!this.client) return { upserted: 0, errors: ['Qdrant client not initialized'] }
    const points = records.map(r => ({ id: r.id, vector: r.vector, payload: r.metadata }))
    await this.client.upsert(this.config.collectionName, { points })
    return { upserted: records.length, errors: [] }
  }

  async query(query: VectorQuery): Promise<VectorResult[]> {
    if (!this.client) return []
    const res = await this.client.search(this.config.collectionName, { vector: query.vector, limit: query.topK, score_threshold: query.minScore })
    return (res || []).map((r: any) => ({ id: r.id, score: r.score, metadata: r.payload || {} }))
  }

  async delete(ids: string[]): Promise<number> {
    if (!this.client) return 0
    await this.client.delete(this.config.collectionName, { points: ids })
    return ids.length
  }

  async getAll(): Promise<VectorRecord[]> { return [] }

  async stats(): Promise<VectorDBStats> {
    if (!this.client) return { totalVectors: 0, dimensions: 0, namespaces: [], backend: this.name }
    const info = await this.client.getCollection(this.config.collectionName)
    return { totalVectors: info.points_count || 0, dimensions: info.config?.params?.vectors?.size || 0, namespaces: [], backend: this.name }
  }
}

/**
 * Migration orchestrator: moves data between vector DB backends.
 */
export class VectorDBMigrator {
  async migrate(
    source: VectorDBBackend,
    target: VectorDBBackend,
    options: { batchSize?: number; namespace?: string } = {}
  ): Promise<MigrationProgress> {
    const batchSize = options.batchSize || 100
    const progress: MigrationProgress = {
      source: source.name,
      target: target.name,
      totalRecords: 0,
      migratedRecords: 0,
      failedRecords: 0,
      status: 'running',
      startedAt: new Date().toISOString(),
      errors: [],
    }

    try {
      const records = await source.getAll(options.namespace)
      progress.totalRecords = records.length

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        try {
          const result = await target.upsert(batch)
          progress.migratedRecords += result.upserted
          progress.errors.push(...result.errors)
          progress.failedRecords += batch.length - result.upserted
        } catch (err) {
          progress.failedRecords += batch.length
          progress.errors.push(err instanceof Error ? err.message : String(err))
        }
      }

      progress.status = progress.failedRecords === 0 ? 'completed' : 'completed'
      progress.completedAt = new Date().toISOString()
    } catch (err) {
      progress.status = 'failed'
      progress.errors.push(err instanceof Error ? err.message : String(err))
    }

    return progress
  }
}
