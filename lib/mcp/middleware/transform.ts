/**
 * Request/Response Transformation Middleware for MCP API Gateway.
 *
 * Allows registering transform pipelines that modify requests before
 * they reach handlers and responses before they are sent to clients.
 *
 * Use cases:
 *   - Header injection (correlation IDs, tracing)
 *   - Request body normalization
 *   - Response envelope wrapping
 *   - Field redaction / masking
 *   - Version-specific payload adaptation
 */

export interface TransformContext {
  /** Unique request ID */
  requestId: string
  /** Authenticated user ID (if any) */
  userId?: string
  /** API version from the request path */
  apiVersion?: string
  /** Additional metadata */
  metadata: Record<string, any>
}

export type RequestTransformer = (
  body: Record<string, any>,
  headers: Record<string, string>,
  ctx: TransformContext
) => { body: Record<string, any>; headers: Record<string, string> }

export type ResponseTransformer = (
  body: Record<string, any>,
  statusCode: number,
  ctx: TransformContext
) => { body: Record<string, any>; statusCode: number }

interface TransformRule {
  id: string
  name: string
  /** Glob or regex pattern for matching request paths */
  pathPattern: string
  priority: number
  enabled: boolean
  requestTransform?: RequestTransformer
  responseTransform?: ResponseTransformer
}

export class TransformPipeline {
  private rules: Map<string, TransformRule> = new Map()

  /** Register a transformation rule. */
  addRule(rule: TransformRule): void {
    this.rules.set(rule.id, rule)
  }

  /** Remove a rule by ID. */
  removeRule(id: string): boolean {
    return this.rules.delete(id)
  }

  /** Get all registered rules (sorted by priority). */
  getRules(): TransformRule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority)
  }

  /**
   * Apply all matching request transformers in priority order.
   */
  transformRequest(
    path: string,
    body: Record<string, any>,
    headers: Record<string, string>,
    ctx: TransformContext
  ): { body: Record<string, any>; headers: Record<string, string> } {
    let result = { body: { ...body }, headers: { ...headers } }

    for (const rule of this.getMatchingRules(path)) {
      if (rule.requestTransform) {
        result = rule.requestTransform(result.body, result.headers, ctx)
      }
    }

    return result
  }

  /**
   * Apply all matching response transformers in priority order.
   */
  transformResponse(
    path: string,
    body: Record<string, any>,
    statusCode: number,
    ctx: TransformContext
  ): { body: Record<string, any>; statusCode: number } {
    let result = { body: { ...body }, statusCode }

    for (const rule of this.getMatchingRules(path)) {
      if (rule.responseTransform) {
        result = rule.responseTransform(result.body, result.statusCode, ctx)
      }
    }

    return result
  }

  private getMatchingRules(path: string): TransformRule[] {
    return this.getRules().filter(rule => {
      if (!rule.enabled) return false
      return this.matchPath(path, rule.pathPattern)
    })
  }

  private matchPath(path: string, pattern: string): boolean {
    if (pattern === '*' || pattern === '**') return true

    // Convert glob-like pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')

    return new RegExp(`^${escaped}$`).test(path)
  }
}

// ── Built-in Transformers ────────────────────────────────────

/** Adds a correlation ID header to every request. */
export const correlationIdTransformer: RequestTransformer = (body, headers, ctx) => {
  return {
    body,
    headers: { ...headers, 'x-correlation-id': ctx.requestId },
  }
}

/** Wraps response body in a standard envelope. */
export const envelopeTransformer: ResponseTransformer = (body, statusCode, ctx) => {
  return {
    body: {
      success: statusCode >= 200 && statusCode < 300,
      data: body,
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        apiVersion: ctx.apiVersion || 'v1',
      },
    },
    statusCode,
  }
}

/** Redacts sensitive fields from response bodies. */
export function createRedactionTransformer(fields: string[]): ResponseTransformer {
  return (body, statusCode, _ctx) => {
    const redacted = JSON.parse(JSON.stringify(body))
    const redact = (obj: any) => {
      if (!obj || typeof obj !== 'object') return
      for (const key of Object.keys(obj)) {
        if (fields.includes(key)) {
          obj[key] = '[REDACTED]'
        } else if (typeof obj[key] === 'object') {
          redact(obj[key])
        }
      }
    }
    redact(redacted)
    return { body: redacted, statusCode }
  }
}

/** Creates a default pipeline with common transformers. */
export function createDefaultPipeline(): TransformPipeline {
  const pipeline = new TransformPipeline()

  pipeline.addRule({
    id: 'correlation-id',
    name: 'Correlation ID',
    pathPattern: '**',
    priority: 0,
    enabled: true,
    requestTransform: correlationIdTransformer,
  })

  pipeline.addRule({
    id: 'redact-secrets',
    name: 'Redact Secrets',
    pathPattern: '**',
    priority: 100,
    enabled: true,
    responseTransform: createRedactionTransformer([
      'password', 'secret', 'apiKey', 'token', 'creditCard',
    ]),
  })

  return pipeline
}
