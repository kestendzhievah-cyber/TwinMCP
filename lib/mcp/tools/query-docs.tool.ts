import { MCPTool, ValidationResult, ExecutionResult } from '../core/types'
import { z } from 'zod'
import { VectorSearchService, QueryDocsInputSchema } from '../../services/vector-search.service'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

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
    strategy: 'redis' as const
  }

  private vectorSearchService: VectorSearchService
  private db: PrismaClient
  private redis: Redis

  constructor() {
    // Initialize database and Redis connections
    this.db = new PrismaClient()
    this.redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379')
    this.vectorSearchService = new VectorSearchService(this.db, this.redis)
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

      // Log de la requête
      console.log(`[QueryDocs] Processing query for library "${validatedInput.library_id}": "${validatedInput.query}"`)
      
      // Rechercher les documents
      const result = await this.vectorSearchService.searchDocuments(validatedInput)
      
      // Log du résultat
      console.log(`[QueryDocs] Found ${result.results.length} results in ${Date.now() - startTime}ms`)
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false, // TODO: Implémenter le cache check
          apiCallsCount: 1,
          tokensReturned: result.totalTokens
        } as any
      }
      
    } catch (error) {
      console.error(`[QueryDocs] Error: ${(error as Error).message}`, (error as Error).stack)
      
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
    console.log(`[QueryDocs] Starting execution with args:`, args)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    // Log après exécution
    console.log(`[QueryDocs] Execution completed:`, {
      success: result.success,
      executionTime: result.metadata?.executionTime,
      tokensReturned: (result.metadata as any)?.tokensReturned
    })
    return result
  }

  async onError(error: Error, args: any): Promise<void> {
    console.error(`[QueryDocs] Error in execution:`, {
      error: error.message,
      stack: error.stack,
      args
    })
    
    // Cleanup resources
    await this.cleanup()
  }

  private async cleanup(): Promise<void> {
    try {
      await this.db.$disconnect()
      await this.redis.disconnect()
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }
}
