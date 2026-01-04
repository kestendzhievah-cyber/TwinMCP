import { z } from 'zod'

// Types de base pour les résultats
export interface ValidationResult {
  success: boolean
  errors?: Array<{
    path: string
    message: string
  }>
  data?: any
}

export interface ExecutionResult {
  success: boolean
  data?: any
  error?: string
  metadata?: {
    executionTime: number
    cacheHit: boolean
    apiCallsCount: number
    cost?: number
  }
}

// Types pour la configuration
export interface RateLimitConfig {
  requests: number
  period: string // '1m', '1h', '1d'
  strategy: 'fixed' | 'sliding' | 'token-bucket'
}

export interface CacheConfig {
  enabled: boolean
  ttl: number // secondes
  key: (args: any) => string
  strategy: 'memory' | 'redis' | 'hybrid'
}

export interface ToolCapabilities {
  async: boolean
  batch: boolean
  streaming: boolean
  webhook: boolean
}

// Interface principale pour les outils MCP
export interface MCPTool {
  // Identifiants
  id: string
  name: string
  version: string
  category: 'communication' | 'productivity' | 'development' | 'data'

  // Métadonnées
  description: string
  author?: string
  tags: string[]

  // Configuration
  requiredConfig: string[]
  optionalConfig?: string[]

  // Schema de validation avec Zod
  inputSchema: z.ZodSchema

  // Méthodes principales
  validate: (args: any) => Promise<ValidationResult>
  execute: (args: any, config: any) => Promise<ExecutionResult>

  // Hooks (optionnels)
  beforeExecute?: (args: any) => Promise<any>
  afterExecute?: (result: ExecutionResult) => Promise<ExecutionResult>
  onError?: (error: Error, args: any) => Promise<void>

  // Capacités
  capabilities: ToolCapabilities

  // Limites
  rateLimit?: RateLimitConfig

  // Cache
  cache?: CacheConfig

  // Métadonnées d'usage
  usageStats?: {
    totalCalls: number
    successRate: number
    avgExecutionTime: number
    lastUsed?: Date
  }
}

// Interface pour les plugins
export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author?: string
  tools: MCPTool[]
  dependencies?: string[]
  config?: Record<string, any>
}

// Interface pour les filtres de recherche
export interface ToolFilters {
  category?: string
  tags?: string[]
  capabilities?: Partial<ToolCapabilities>
  hasRateLimit?: boolean
  hasCache?: boolean
}

// Interface pour les métriques
export interface ToolMetrics {
  toolId: string
  userId: string
  timestamp: Date
  executionTime: number
  cacheHit: boolean
  success: boolean
  errorType?: string
  apiCallsCount: number
  estimatedCost?: number
}

// Types pour les jobs de queue
export interface QueueJob {
  id: string
  toolId: string
  args: any
  userId: string
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: ExecutionResult
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  retries: number
  maxRetries: number
}
