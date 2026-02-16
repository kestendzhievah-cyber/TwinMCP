import { InMemoryVectorDB, VectorDBMigrator } from '../../src/services/embeddings/vector-db-adapter.service'

describe('VectorDBAdapter', () => {
  describe('InMemoryVectorDB', () => {
    let db: InMemoryVectorDB

    beforeEach(() => {
      db = new InMemoryVectorDB()
    })

    it('upserts records', async () => {
      const result = await db.upsert([
        { id: 'a', vector: [1, 0, 0], metadata: { name: 'A' } },
        { id: 'b', vector: [0, 1, 0], metadata: { name: 'B' } },
      ])
      expect(result.upserted).toBe(2)
      expect(result.errors.length).toBe(0)
    })

    it('queries by vector similarity', async () => {
      await db.upsert([
        { id: 'a', vector: [1, 0, 0], metadata: { name: 'A' } },
        { id: 'b', vector: [0, 1, 0], metadata: { name: 'B' } },
        { id: 'c', vector: [0.9, 0.1, 0], metadata: { name: 'C' } },
      ])

      const results = await db.query({ vector: [1, 0, 0], topK: 2 })
      expect(results.length).toBe(2)
      expect(results[0].id).toBe('a')
    })

    it('respects minScore', async () => {
      await db.upsert([
        { id: 'a', vector: [1, 0, 0], metadata: {} },
        { id: 'b', vector: [0, 0, 1], metadata: {} },
      ])

      const results = await db.query({ vector: [1, 0, 0], topK: 10, minScore: 0.9 })
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('a')
    })

    it('filters by namespace', async () => {
      await db.upsert([
        { id: 'a', vector: [1, 0], metadata: {}, namespace: 'ns1' },
        { id: 'b', vector: [1, 0], metadata: {}, namespace: 'ns2' },
      ])

      const results = await db.query({ vector: [1, 0], topK: 10, namespace: 'ns1' })
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('a')
    })

    it('deletes records', async () => {
      await db.upsert([{ id: 'a', vector: [1], metadata: {} }])
      const count = await db.delete(['a'])
      expect(count).toBe(1)
      const stats = await db.stats()
      expect(stats.totalVectors).toBe(0)
    })

    it('gets all records', async () => {
      await db.upsert([
        { id: 'a', vector: [1], metadata: {}, namespace: 'ns1' },
        { id: 'b', vector: [2], metadata: {}, namespace: 'ns2' },
      ])
      const all = await db.getAll()
      expect(all.length).toBe(2)

      const ns1 = await db.getAll('ns1')
      expect(ns1.length).toBe(1)
    })

    it('reports stats', async () => {
      await db.upsert([
        { id: 'a', vector: [1, 0, 0], metadata: {}, namespace: 'ns1' },
        { id: 'b', vector: [0, 1, 0], metadata: {}, namespace: 'ns2' },
      ])

      const stats = await db.stats()
      expect(stats.totalVectors).toBe(2)
      expect(stats.dimensions).toBe(3)
      expect(stats.namespaces.length).toBe(2)
      expect(stats.backend).toBe('in-memory')
    })
  })

  describe('VectorDBMigrator', () => {
    it('migrates data between backends', async () => {
      const source = new InMemoryVectorDB()
      const target = new InMemoryVectorDB()

      await source.upsert([
        { id: 'a', vector: [1, 0], metadata: { name: 'A' } },
        { id: 'b', vector: [0, 1], metadata: { name: 'B' } },
        { id: 'c', vector: [1, 1], metadata: { name: 'C' } },
      ])

      const migrator = new VectorDBMigrator()
      const progress = await migrator.migrate(source, target, { batchSize: 2 })

      expect(progress.totalRecords).toBe(3)
      expect(progress.migratedRecords).toBe(3)
      expect(progress.failedRecords).toBe(0)
      expect(progress.status).toBe('completed')

      const targetStats = await target.stats()
      expect(targetStats.totalVectors).toBe(3)
    })

    it('reports migration progress', async () => {
      const source = new InMemoryVectorDB()
      const target = new InMemoryVectorDB()

      const migrator = new VectorDBMigrator()
      const progress = await migrator.migrate(source, target)

      expect(progress.totalRecords).toBe(0)
      expect(progress.status).toBe('completed')
      expect(progress.startedAt).toBeDefined()
      expect(progress.completedAt).toBeDefined()
    })
  })
})
