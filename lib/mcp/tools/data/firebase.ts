import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'
import { logger } from '@/lib/logger'

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
      // Execute before hook
      await this.beforeExecute(args)

      // Validation des arguments
      const validation = await this.validate(args)
      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`)
      }

      // Vérifier les rate limits
      const userLimit = await rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id, config.rateLimit || {})
      if (!userLimit) {
        throw new Error('Rate limit exceeded for Firebase tool')
      }

      // Vérifier le cache
      const cache = getCache()
      const cacheKey = this.cache!.key(args)
      const cachedResult = await cache.get(cacheKey)

      if (cachedResult && args.operation === 'read') {
        logger.debug(`Firebase cache hit for ${args.collection}`)
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

      const execResult: ExecutionResult = {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: args.operation === 'write' ? 0.002 : 0.001
        }
      }

      // Execute after hook
      return await this.afterExecute(execResult)

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
    const projectId = config.firebase_project_id || process.env.FIREBASE_PROJECT_ID
    const apiKey = config.firebase_api_key || process.env.FIREBASE_API_KEY
    if (projectId && apiKey) {
      // Real Firestore REST API call
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
      const url = args.documentId
        ? `${baseUrl}/${args.collection}/${args.documentId}?key=${apiKey}`
        : `${baseUrl}/${args.collection}?key=${apiKey}&pageSize=${args.limit || 20}`
      const response = await fetch(url)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(`Firestore API error: ${err.error?.message || response.statusText}`)
      }
      const data = await response.json()
      return { ...data, _simulation: false }
    }

    // Simulation mode
    return {
      documents: [],
      collection: args.collection,
      documentId: args.documentId || null,
      _simulation: true,
      _note: 'Set FIREBASE_PROJECT_ID and FIREBASE_API_KEY env vars for real Firestore integration'
    }
  }

  private async writeFirebase(args: any, config: any): Promise<any> {
    const projectId = config.firebase_project_id || process.env.FIREBASE_PROJECT_ID
    const apiKey = config.firebase_api_key || process.env.FIREBASE_API_KEY
    if (projectId && apiKey) {
      // Real Firestore REST API write
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
      const docPath = args.documentId
        ? `${baseUrl}/${args.collection}/${args.documentId}?key=${apiKey}`
        : `${baseUrl}/${args.collection}?key=${apiKey}`
      const response = await fetch(docPath, {
        method: args.documentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: args.data })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(`Firestore write error: ${err.error?.message || response.statusText}`)
      }
      const data = await response.json()
      return { ...data, _simulation: false }
    }

    // Simulation mode
    return {
      id: args.documentId || `doc_${Date.now()}`,
      collection: args.collection,
      operation: args.merge ? 'merge' : 'create',
      writeTime: new Date().toISOString(),
      _simulation: true,
      _note: 'Set FIREBASE_PROJECT_ID and FIREBASE_API_KEY env vars for real Firestore integration'
    }
  }

  async beforeExecute(args: any): Promise<any> {
    if (args.operation === 'write') {
      logger.debug(`Writing to Firebase: ${args.collection}/${args.documentId || 'auto'}`)
    } else {
      logger.debug(`Reading from Firebase: ${args.collection}${args.documentId ? `/${args.documentId}` : ''}`)
    }
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      if (result.data?.operation === 'merge' || result.data?.operation === 'create') {
        logger.debug(`Firebase write successful: ${result.data?.id}`)
      } else {
        logger.debug(`Firebase read successful: ${result.data?.totalCount || 1} documents`)
      }
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    logger.error(`Firebase error: ${error.message}`)
  }
}
