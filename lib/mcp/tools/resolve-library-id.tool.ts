import { MCPTool, ValidationResult, ExecutionResult } from '../core/types'
import { z } from 'zod'
import { LibraryResolutionService, ResolveLibraryIdInputSchema, ResolveLibraryIdOutput } from '../../services/library-resolution.service'
import { logger } from '@/lib/logger'

export class ResolveLibraryIdTool implements MCPTool {
  id = 'resolve-library-id'
  name = 'resolve-library-id'
  version = '1.0.0'
  category = 'development' as const
  description = 'Resolve library names and find matching software libraries'
  author = 'TwinMCP Team'
  tags = ['library', 'search', 'resolution', 'documentation']
  
  requiredConfig: string[] = ['database', 'redis']
  optionalConfig: string[] = ['openai_api_key']
  
  inputSchema = z.object({
    query: z.string()
      .min(1, "La requête est requise")
      .max(200, "La requête est trop longue")
      .describe("Nom de la bibliothèque à rechercher (ex: 'react', 'express', 'django')"),
    
    context: z.object({
      language: z.string()
        .optional()
        .describe("Langage de programmation (ex: 'javascript', 'python', 'rust')"),
      
      framework: z.string()
        .optional()
        .describe("Framework associé (ex: 'node', 'django', 'spring')"),
      
      ecosystem: z.string()
        .optional()
        .describe("Écosystème (ex: 'npm', 'pip', 'cargo', 'composer')")
    }).optional()
    .describe("Contexte optionnel pour affiner la recherche"),
    
    limit: z.number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Nombre maximum de résultats à retourner"),
    
    include_aliases: z.boolean()
      .default(true)
      .describe("Inclure les alias et variantes dans la recherche")
  })

  capabilities = {
    async: true,
    batch: false,
    streaming: false,
    webhook: false
  }

  rateLimit = {
    requests: 100,
    period: '1m',
    strategy: 'sliding' as const
  }

  cache = {
    enabled: true,
    ttl: 300, // 5 minutes
    key: (args: any) => `resolve-library-id:${JSON.stringify(args)}`,
    strategy: 'redis' as const
  }

  private resolutionService: LibraryResolutionService

  constructor(resolutionService: LibraryResolutionService) {
    this.resolutionService = resolutionService
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
            apiCallsCount: 0
          }
        }
      }

      const validatedInput = validation.data

      // Log de la requête
      logger.debug(`[ResolveLibraryId] Processing query: "${validatedInput.query}"`)
      
      // Résoudre la bibliothèque
      const result = await this.resolutionService.resolveLibrary(validatedInput)
      
      // Log du résultat
      logger.debug(`[ResolveLibraryId] Found ${result.results.length} results in ${result.processingTimeMs}ms`)
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1
        }
      }
      
    } catch (error) {
      logger.error(`[ResolveLibraryId] Error: ${(error as Error).message}`)
      
      return {
        success: false,
        error: 'Library resolution failed',
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
    logger.debug(`[ResolveLibraryId] Starting execution with args:`, args)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    // Log après exécution
    logger.debug(`[ResolveLibraryId] Execution completed:`, {
      success: result.success,
      executionTime: result.metadata?.executionTime
    })
    return result
  }

  async onError(error: Error, args: any): Promise<void> {
    logger.error(`[ResolveLibraryId] Error in execution:`, {
      error: error.message,
      stack: error.stack,
      args
    })
  }
}
