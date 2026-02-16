/**
 * Distributed Tracing Service.
 *
 * Tracks requests across services with spans:
 *   - Trace creation with unique IDs
 *   - Span hierarchy (parent/child)
 *   - Timing and duration tracking
 *   - Tag and log annotation
 *   - Trace search and filtering
 *   - Performance bottleneck detection
 */

export interface Trace {
  traceId: string
  rootSpanId: string
  serviceName: string
  operationName: string
  startTime: string
  endTime?: string
  durationMs?: number
  status: 'active' | 'completed' | 'error'
  tags: Record<string, string>
  spanCount: number
}

export interface Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  operationName: string
  serviceName: string
  startTime: string
  endTime?: string
  durationMs?: number
  status: 'active' | 'completed' | 'error'
  tags: Record<string, string>
  logs: SpanLog[]
}

export interface SpanLog {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  fields?: Record<string, any>
}

export interface TraceSearchQuery {
  serviceName?: string
  operationName?: string
  minDurationMs?: number
  maxDurationMs?: number
  status?: string
  tags?: Record<string, string>
  limit?: number
}

export interface BottleneckReport {
  traceId: string
  slowestSpans: Array<{ spanId: string; operationName: string; serviceName: string; durationMs: number }>
  totalDurationMs: number
  criticalPath: string[]
}

export class DistributedTracingService {
  private traces: Map<string, Trace> = new Map()
  private spans: Map<string, Span> = new Map()
  private idCounter = 0

  // ── Trace Management ───────────────────────────────────────

  startTrace(serviceName: string, operationName: string, tags?: Record<string, string>): Trace {
    const traceId = `trace-${++this.idCounter}`
    const rootSpanId = `span-${++this.idCounter}`
    const now = new Date().toISOString()

    const rootSpan: Span = {
      spanId: rootSpanId, traceId, operationName, serviceName,
      startTime: now, status: 'active', tags: tags || {}, logs: [],
    }
    this.spans.set(rootSpanId, rootSpan)

    const trace: Trace = {
      traceId, rootSpanId, serviceName, operationName,
      startTime: now, status: 'active', tags: tags || {}, spanCount: 1,
    }
    this.traces.set(traceId, trace)
    return trace
  }

  endTrace(traceId: string, status: 'completed' | 'error' = 'completed'): boolean {
    const trace = this.traces.get(traceId)
    if (!trace) return false
    const now = new Date().toISOString()
    trace.endTime = now
    trace.durationMs = new Date(now).getTime() - new Date(trace.startTime).getTime()
    trace.status = status

    // End root span too
    const rootSpan = this.spans.get(trace.rootSpanId)
    if (rootSpan && !rootSpan.endTime) {
      rootSpan.endTime = now
      rootSpan.durationMs = trace.durationMs
      rootSpan.status = status
    }
    return true
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId)
  }

  getTraces(): Trace[] {
    return Array.from(this.traces.values())
  }

  get traceCount(): number { return this.traces.size }

  // ── Span Management ────────────────────────────────────────

  startSpan(traceId: string, operationName: string, serviceName: string, parentSpanId?: string, tags?: Record<string, string>): Span | null {
    const trace = this.traces.get(traceId)
    if (!trace) return null

    const span: Span = {
      spanId: `span-${++this.idCounter}`,
      traceId, parentSpanId: parentSpanId || trace.rootSpanId,
      operationName, serviceName,
      startTime: new Date().toISOString(),
      status: 'active', tags: tags || {}, logs: [],
    }
    this.spans.set(span.spanId, span)
    trace.spanCount++
    return span
  }

  endSpan(spanId: string, status: 'completed' | 'error' = 'completed'): boolean {
    const span = this.spans.get(spanId)
    if (!span) return false
    const now = new Date().toISOString()
    span.endTime = now
    span.durationMs = new Date(now).getTime() - new Date(span.startTime).getTime()
    span.status = status
    return true
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId)
  }

  getTraceSpans(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter(s => s.traceId === traceId)
  }

  getChildSpans(parentSpanId: string): Span[] {
    return Array.from(this.spans.values()).filter(s => s.parentSpanId === parentSpanId)
  }

  // ── Tags & Logs ────────────────────────────────────────────

  addSpanTag(spanId: string, key: string, value: string): boolean {
    const span = this.spans.get(spanId)
    if (!span) return false
    span.tags[key] = value
    return true
  }

  addSpanLog(spanId: string, level: SpanLog['level'], message: string, fields?: Record<string, any>): boolean {
    const span = this.spans.get(spanId)
    if (!span) return false
    span.logs.push({ timestamp: new Date().toISOString(), level, message, fields })
    return true
  }

  // ── Search ─────────────────────────────────────────────────

  searchTraces(query: TraceSearchQuery): Trace[] {
    let results = Array.from(this.traces.values())

    if (query.serviceName) results = results.filter(t => t.serviceName === query.serviceName)
    if (query.operationName) results = results.filter(t => t.operationName === query.operationName)
    if (query.status) results = results.filter(t => t.status === query.status)
    if (query.minDurationMs !== undefined) results = results.filter(t => (t.durationMs || 0) >= query.minDurationMs!)
    if (query.maxDurationMs !== undefined) results = results.filter(t => (t.durationMs || 0) <= query.maxDurationMs!)
    if (query.tags) {
      for (const [k, v] of Object.entries(query.tags)) {
        results = results.filter(t => t.tags[k] === v)
      }
    }

    results.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    if (query.limit) results = results.slice(0, query.limit)
    return results
  }

  // ── Bottleneck Detection ───────────────────────────────────

  detectBottlenecks(traceId: string, topN: number = 5): BottleneckReport | null {
    const trace = this.traces.get(traceId)
    if (!trace) return null

    const spans = this.getTraceSpans(traceId).filter(s => s.durationMs !== undefined)
    spans.sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))

    const slowestSpans = spans.slice(0, topN).map(s => ({
      spanId: s.spanId, operationName: s.operationName,
      serviceName: s.serviceName, durationMs: s.durationMs || 0,
    }))

    const criticalPath = this.buildCriticalPath(traceId)

    return {
      traceId,
      slowestSpans,
      totalDurationMs: trace.durationMs || 0,
      criticalPath,
    }
  }

  private buildCriticalPath(traceId: string): string[] {
    const trace = this.traces.get(traceId)
    if (!trace) return []

    const path: string[] = []
    let currentSpanId: string | undefined = trace.rootSpanId

    while (currentSpanId) {
      const span = this.spans.get(currentSpanId)
      if (!span) break
      path.push(`${span.serviceName}:${span.operationName}`)

      const children = this.getChildSpans(currentSpanId)
      if (children.length === 0) break
      // Follow the longest child
      children.sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
      currentSpanId = children[0].spanId
    }

    return path
  }
}

export const distributedTracingService = new DistributedTracingService()
