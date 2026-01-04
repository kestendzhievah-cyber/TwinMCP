import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'

// Schema pour la lecture Firebase
const firebaseReadSchema = z.object({
  collection: z.string().min(1, 'Collection name is required'),
  documentId: z.string().optional(),
  where: z.array(z.object({
    field: z.string(),
    operator: z.enum(['==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains']),
    value: z.any()
  })).optional(),
  orderBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).default('asc')
  }).optional(),
  limit: z.number().min(1).max(100).default(50),
  select: z.array(z.string()).optional()
})

// Schema pour l'écriture Firebase
const firebaseWriteSchema = z.object({
  collection: z.string().min(1, 'Collection name is required'),
  documentId: z.string().optional(),
  data: z.record(z.any()).refine(data => Object.keys(data).length > 0, 'Data cannot be empty'),
  merge: z.boolean().default(true),
  timestamp: z.boolean().default(true)
})

export class FirebaseTool implements MCPTool {
  id = 'firebase'
  name = 'Firebase Database'
  version = '1.0.0'
  category: 'data' = 'data'

  description = 'Read and write data to Firebase Firestore with advanced querying'
  author = 'MCP Team'
  tags = ['firebase', 'firestore', 'database', 'data', 'nosql']

  requiredConfig = ['firebase_project_id', 'firebase_service_account']
  optionalConfig = ['firebase_database_url', 'default_collection']

  inputSchema = z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('read'),
      ...firebaseReadSchema.shape
    }),
    z.object({
      operation: z.literal('write'),
      ...firebaseWriteSchema.shape
    })
  ])

  capabilities = {
    async: false,
    batch: true,
    streaming: false,
    webhook: false
  }

  rateLimit = {
    requests: 1000,
    period: '1h',
    strategy: 'sliding' as const
  }

  cache = {
    enabled: true,
    ttl: 300, // 5 minutes
    key: (args: any) => `firebase:${args.operation}:${args.collection}:${args.documentId || 'list'}`,
    strategy: 'memory' as const
  }

  async validate(args: any): Promise<ValidationResult> {
    try {
      const validated = await this.inputSchema.parseAsync(args)
      return { success: true, data: validated }
    } catch (error: any) {
      return {
        success: false,
        errors: error.errors?.map((e: z.ZodIssue) => ({
          path: e.path.join('.'),
          message: e.message
        })) || [{ path: 'unknown', message: 'Validation failed' }]
      }
    }
  }

  async execute(args: any, config: any): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      // Validation des arguments
      const validation = await this.validate(args)
      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`)
      }

      // Vérifier les rate limits
      const userLimit = await rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id)
      if (!userLimit) {
        throw new Error('Rate limit exceeded for Firebase tool')
      }

      // Vérifier le cache
      const cache = getCache()
      const cacheKey = this.cache!.key(args)
      const cachedResult = await cache.get(cacheKey)

      if (cachedResult && args.operation === 'read') {
        console.log(`🔥 Firebase cache hit for ${args.collection}`)
        getMetrics().track({
          toolId: this.id,
          userId: config.userId || 'anonymous',
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          cacheHit: true,
          success: true,
          apiCallsCount: 0,
          estimatedCost: 0
        })

        return {
          success: true,
          data: cachedResult,
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: true,
            apiCallsCount: 0,
            cost: 0
          }
        }
      }

      // Exécuter l'opération Firebase
      let result
      if (args.operation === 'read') {
        result = await this.readFirebase(args, config)
      } else {
        result = await this.writeFirebase(args, config)
      }

      // Mettre en cache (seulement pour les lectures)
      if (args.operation === 'read') {
        await cache.set(cacheKey, result, this.cache!.ttl)
      }

      // Tracker les métriques
      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: false,
        success: true,
        apiCallsCount: 1,
        estimatedCost: args.operation === 'write' ? 0.002 : 0.001 // Coût plus élevé pour l'écriture
      })

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: args.operation === 'write' ? 0.002 : 0.001
        }
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime

      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime,
        cacheHit: false,
        success: false,
        errorType: error.name || 'FirebaseError',
        apiCallsCount: 1,
        estimatedCost: 0
      })

      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0
        }
      }
    }
  }

  private async readFirebase(args: any, config: any): Promise<any> {
    // Simulation de la lecture Firebase
    // Dans une vraie implémentation, utiliser Firebase Admin SDK

    await new Promise(resolve => setTimeout(resolve, 100)) // Simulation réseau

    if (args.documentId) {
      // Lecture d'un document spécifique
      return {
        id: args.documentId,
        collection: args.collection,
        data: {
          name: `Document ${args.documentId}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...this.generateMockData()
        },
        exists: true,
        metadata: {
          readTime: new Date().toISOString(),
          apiCalls: 1
        }
      }
    } else {
      // Lecture de la collection
      const documents = []
      const numDocs = Math.floor(Math.random() * args.limit) + 1

      for (let i = 0; i < numDocs; i++) {
        documents.push({
          id: `doc_${i + 1}`,
          data: {
            name: `Document ${i + 1}`,
            value: Math.floor(Math.random() * 1000),
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            ...this.generateMockData()
          }
        })
      }

      return {
        documents,
        totalCount: numDocs,
        collection: args.collection,
        hasMore: numDocs >= args.limit,
        metadata: {
          queryTime: 100,
          apiCalls: 1,
          filtered: !!args.where
        }
      }
    }
  }

  private async writeFirebase(args: any, config: any): Promise<any> {
    // Simulation de l'écriture Firebase

    await new Promise(resolve => setTimeout(resolve, 150)) // Simulation réseau

    const documentId = args.documentId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id: documentId,
      collection: args.collection,
      data: args.data,
      writeTime: new Date().toISOString(),
      operation: args.merge ? 'merge' : 'create',
      metadata: {
        apiCalls: 1,
        size: JSON.stringify(args.data).length,
        timestamped: args.timestamp
      }
    }
  }

  private generateMockData(): any {
    return {
      status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
      tags: ['tag1', 'tag2', 'tag3'].filter(() => Math.random() > 0.5),
      metadata: {
        version: Math.floor(Math.random() * 10) + 1,
        lastModified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  }

  async beforeExecute(args: any): Promise<any> {
    if (args.operation === 'write') {
      console.log(`🔥 Writing to Firebase: ${args.collection}/${args.documentId || 'auto'}`)
    } else {
      console.log(`🔥 Reading from Firebase: ${args.collection}${args.documentId ? `/${args.documentId}` : ''}`)
    }
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      if (result.data?.operation === 'merge' || result.data?.operation === 'create') {
        console.log(`✅ Firebase write successful: ${result.data?.id}`)
      } else {
        console.log(`✅ Firebase read successful: ${result.data?.totalCount || 1} documents`)
      }
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    console.error(`❌ Firebase error: ${error.message}`)
  }
}
