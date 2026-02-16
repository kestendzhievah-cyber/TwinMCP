import { MCPTool, ExecutionResult, ValidationResult } from './types'
import { getCache } from './cache'
import { validator } from './validator'
import { CircuitBreakerRegistry, getCircuitBreaker } from './circuit-breaker'

interface ExecutionConfig {
  userId?: string
  rateLimit?: { requests: number; period: string; strategy: string }
  [key: string]: any
}

interface ExecutorOptions {
  /** Skip cache lookup (e.g. for write operations) */
  skipCache?: boolean
  /** Custom cache key override */
  cacheKey?: string
  /** Skip rate limit check */
  skipRateLimit?: boolean
  /** Skip security validation */
  skipSecurity?: boolean
}

export class ToolExecutor {
  private rateLimiter: any = null
  private metrics: any = null
  private circuitBreaker: CircuitBreakerRegistry

  constructor() {
    this.circuitBreaker = getCircuitBreaker()
    this.lazyInit()
  }

  private async lazyInit(): Promise<void> {
    if (!this.rateLimiter) {
      try {
        const { rateLimiter } = await import('../middleware/rate-limit')
        this.rateLimiter = rateLimiter
      } catch {
        // Middleware not available — skip rate limiting
      }
    }
    if (!this.metrics) {
      try {
        const { getMetrics } = await import('../utils/metrics')
        this.metrics = getMetrics()
      } catch {
        // Metrics not available — skip tracking
      }
    }
  }

  /**
   * Execute a tool through the full pipeline:
   * 1. beforeExecute hook
   * 2. Input validation (Zod schema)
   * 3. Security validation (XSS, SQL injection, path traversal)
   * 4. Rate limit check
   * 5. Cache lookup (read operations)
   * 6. Tool execution
   * 7. Cache store (read operations)
   * 8. Metrics tracking
   * 9. afterExecute hook
   */
  async execute(
    tool: MCPTool,
    args: any,
    config: ExecutionConfig = {},
    options: ExecutorOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    await this.lazyInit()

    try {
      // 1. beforeExecute hook
      let processedArgs = args
      if (tool.beforeExecute) {
        processedArgs = await tool.beforeExecute(args)
      }

      // 2. Input validation
      const validation = await tool.validate(processedArgs)
      if (!validation.success) {
        return this.buildErrorResult(startTime, 'Invalid input parameters', {
          errors: validation.errors
        })
      }

      // 3. Security validation
      if (!options.skipSecurity) {
        const securityResult = await validator.securityValidate(processedArgs)
        if (!securityResult.success) {
          return this.buildErrorResult(startTime, 'Security validation failed', {
            errors: securityResult.errors
          })
        }
      }

      // 4. Circuit breaker check
      if (!this.circuitBreaker.allowRequest(tool.id)) {
        return this.buildErrorResult(startTime, `Circuit breaker OPEN for ${tool.name} — too many recent failures`)
      }

      // 5. Rate limit check
      if (!options.skipRateLimit && this.rateLimiter) {
        const userId = config.userId || 'anonymous'
        const allowed = await this.rateLimiter.checkUserLimit(
          userId,
          tool.id,
          config.rateLimit || {}
        )
        if (!allowed) {
          return this.buildErrorResult(startTime, `Rate limit exceeded for ${tool.name}`)
        }
      }

      // 6. Cache lookup
      let cacheHit = false
      const shouldCache = !options.skipCache && tool.cache?.enabled
      const cacheKey = options.cacheKey || (shouldCache ? tool.cache!.key(processedArgs) : '')

      if (shouldCache && cacheKey) {
        try {
          const cache = getCache()
          const cached = await cache.get(cacheKey)
          if (cached) {
            cacheHit = true
            this.trackMetrics(tool, config, startTime, true, true)
            const cachedResult: ExecutionResult = {
              success: true,
              data: cached,
              metadata: {
                executionTime: Date.now() - startTime,
                cacheHit: true,
                apiCallsCount: 0,
                cost: 0
              }
            }
            // Still run afterExecute hook on cached results
            if (tool.afterExecute) {
              return await tool.afterExecute(cachedResult)
            }
            return cachedResult
          }
        } catch {
          // Cache unavailable — proceed without it
        }
      }

      // 7. Tool execution
      const result = await tool.execute(processedArgs, config)

      // Record circuit breaker outcome
      if (result.success) {
        this.circuitBreaker.recordSuccess(tool.id)
      } else {
        this.circuitBreaker.recordFailure(tool.id)
      }

      // 8. Cache store (only on success, only for cacheable operations)
      if (shouldCache && cacheKey && result.success) {
        try {
          const cache = getCache()
          await cache.set(cacheKey, result.data, tool.cache!.ttl)
        } catch {
          // Cache write failed — non-blocking
        }
      }

      // 9. Metrics tracking
      this.trackMetrics(tool, config, startTime, false, result.success, result.error)

      // 10. afterExecute hook
      if (tool.afterExecute) {
        return await tool.afterExecute(result)
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Record failure in circuit breaker
      this.circuitBreaker.recordFailure(tool.id)

      // onError hook
      if (tool.onError) {
        await tool.onError(
          error instanceof Error ? error : new Error(errorMessage),
          args
        )
      }

      this.trackMetrics(tool, config, startTime, false, false, errorMessage)

      return this.buildErrorResult(startTime, errorMessage)
    }
  }

  /**
   * Execute multiple tools in parallel (batch execution)
   */
  async executeBatch(
    requests: Array<{ tool: MCPTool; args: any; config?: ExecutionConfig; options?: ExecutorOptions }>,
    concurrency: number = 5
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = new Array(requests.length)
    const queue = [...requests.entries()]

    const worker = async () => {
      while (queue.length > 0) {
        const entry = queue.shift()
        if (!entry) break
        const [index, req] = entry
        results[index] = await this.execute(req.tool, req.args, req.config, req.options)
      }
    }

    // Run workers in parallel up to concurrency limit
    const workers = Array.from({ length: Math.min(concurrency, requests.length) }, () => worker())
    await Promise.all(workers)

    return results
  }

  private buildErrorResult(startTime: number, error: string, extra?: any): ExecutionResult {
    return {
      success: false,
      error,
      metadata: {
        executionTime: Date.now() - startTime,
        cacheHit: false,
        apiCallsCount: 0,
        ...extra
      }
    }
  }

  private trackMetrics(
    tool: MCPTool,
    config: ExecutionConfig,
    startTime: number,
    cacheHit: boolean,
    success: boolean,
    errorType?: string
  ): void {
    if (!this.metrics) return
    try {
      this.metrics.track({
        toolId: tool.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit,
        success,
        apiCallsCount: cacheHit ? 0 : 1,
        estimatedCost: 0,
        ...(errorType ? { errorType } : {})
      })
    } catch {
      // Metrics tracking is best-effort
    }
  }
}

// Singleton instance
let globalExecutor: ToolExecutor | null = null

export function getToolExecutor(): ToolExecutor {
  if (!globalExecutor) {
    globalExecutor = new ToolExecutor()
  }
  return globalExecutor
}
