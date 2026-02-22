import { MCPTool, ValidationResult, ExecutionResult } from '../core/types'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export class QueryDocsTool implements MCPTool {
  id = 'query-docs'
  name = 'query-docs'
  version = '1.0.0'
  category = 'development' as const
  description = 'Search documentation for a specific library'
  author = 'TwinMCP Team'
  tags = ['documentation', 'search', 'vector', 'query']
  
  requiredConfig: string[] = ['database', 'redis', 'vector_store']
  optionalConfig: string[] = ['openai_api_key']
  
  inputSchema = z.object({
    library_id: z.string()
      .min(1, "L'ID de bibliothèque est requis")
      .describe("Identifiant unique de la bibliothèque (ex: 'react', 'nodejs')"),
    
    query: z.string()
      .min(1, "La requête est requise")
      .max(1000, "La requête est trop longue")
      .describe("Question ou recherche sur la documentation"),
    
    version: z.string()
      .optional()
      .describe("Version spécifique de la bibliothèque"),
    
    max_results: z.number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Nombre maximum de résultats à retourner"),
    
    include_code: z.boolean()
      .default(true)
      .describe("Inclure les snippets de code dans les résultats"),
    
    context_limit: z.number()
      .int()
      .min(1000)
      .max(8000)
      .default(4000)
      .describe("Limite de tokens pour le contexte")
  })

  capabilities = {
    async: true,
    batch: false,
    streaming: false,
    webhook: false
  }

  rateLimit = {
    requests: 50,
    period: '1m',
    strategy: 'sliding' as const
  }

  cache = {
    enabled: true,
    ttl: 600, // 10 minutes
    key: (args: any) => `query-docs:${JSON.stringify(args)}`,
    strategy: 'memory' as const
  }

  private vectorSearchService: any = null

  constructor() {
    // Lazy init — service is created on first execute() call
  }

  private async ensureService(): Promise<void> {
    if (this.vectorSearchService) return
    try {
      const { prisma } = await import('@/lib/prisma')
      let redisClient: any = null
      try {
        const redisModule = await import('@/lib/redis')
        redisClient = redisModule.redis
      } catch {
        logger.warn('[QueryDocs] Redis unavailable — running without cache')
      }
      const { VectorSearchService } = await import('../../services/vector-search.service')
      this.vectorSearchService = new VectorSearchService(prisma, redisClient)
    } catch (error) {
      logger.error('[QueryDocs] Failed to initialize service:', (error as Error).message)
      throw new Error('QueryDocs service initialization failed')
    }
  }

  async validate(args: any): Promise<ValidationResult> {
    try {
      const validatedInput = this.inputSchema.parse(args)
      return {
        success: true,
        data: validatedInput
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        }
      }
      return {
        success: false,
        errors: [{ path: 'unknown', message: (error as Error).message }]
      }
    }
  }

  async execute(args: any, config: any): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      // Valider l'entrée
      const validation = await this.validate(args)
      if (!validation.success) {
        return {
          success: false,
          error: 'Invalid input parameters',
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: false,
            apiCallsCount: 0,
            errors: validation.errors
          } as any
        }
      }

      const validatedInput = validation.data

      // Ensure service is initialized
      await this.ensureService()

      // Check cache first
      let cacheHit = false
      const cacheKey = `query-docs:${validatedInput.library_id}:${validatedInput.query}:${validatedInput.version || 'latest'}`
      try {
        const { getCache } = await import('../core')
        const cache = getCache()
        const cached = await cache.get(cacheKey)
        if (cached) {
          cacheHit = true
          logger.debug(`[QueryDocs] Cache hit for "${validatedInput.library_id}": "${validatedInput.query}"`)
          return {
            success: true,
            data: cached,
            metadata: {
              executionTime: Date.now() - startTime,
              cacheHit: true,
              apiCallsCount: 0,
              tokensReturned: (cached as any).totalTokens || 0
            } as any
          }
        }
      } catch {
        // Cache unavailable — proceed without it
      }

      // Log de la requête
      logger.debug(`[QueryDocs] Processing query for library "${validatedInput.library_id}": "${validatedInput.query}"`)
      
      // Rechercher les documents
      const result = await this.vectorSearchService.searchDocuments(validatedInput)
      
      // Store in cache (best-effort)
      try {
        const { getCache } = await import('../core')
        await getCache().set(cacheKey, result, 300) // 5 min TTL
      } catch {
        // Cache write failed — non-blocking
      }

      // Log du résultat
      logger.debug(`[QueryDocs] Found ${result.results.length} results in ${Date.now() - startTime}ms`)
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          tokensReturned: result.totalTokens
        } as any
      }
      
    } catch (error) {
      logger.error(`[QueryDocs] Error: ${(error as Error).message}`)
      
      return {
        success: false,
        error: 'Documentation search failed',
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 0
        }
      }
    }
  }

  async beforeExecute(args: any): Promise<any> {
    // Log avant exécution
    logger.debug(`[QueryDocs] Starting execution with args:`, args)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    // Log après exécution
    logger.debug(`[QueryDocs] Execution completed:`, {
      success: result.success,
      executionTime: result.metadata?.executionTime,
      tokensReturned: (result.metadata as any)?.tokensReturned
    })
    return result
  }

  async onError(error: Error, args: any): Promise<void> {
    logger.error(`[QueryDocs] Error in execution:`, {
      error: error.message,
      stack: error.stack,
      args
    })
    
    // Cleanup resources
    await this.cleanup()
  }

  private async cleanup(): Promise<void> {
    // Shared singletons — no per-instance cleanup needed
  }
}
