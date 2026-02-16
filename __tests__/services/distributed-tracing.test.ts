import { DistributedTracingService } from '../../src/services/analytics/distributed-tracing.service'

describe('DistributedTracingService', () => {
  let service: DistributedTracingService

  beforeEach(() => {
    service = new DistributedTracingService()
  })

  describe('Trace management', () => {
    it('starts a trace', () => {
      const t = service.startTrace('api-gateway', 'GET /users')
      expect(t.traceId).toBeDefined()
      expect(t.status).toBe('active')
      expect(t.spanCount).toBe(1)
    })

    it('ends a trace', () => {
      const t = service.startTrace('api', 'request')
      expect(service.endTrace(t.traceId)).toBe(true)
      expect(service.getTrace(t.traceId)!.status).toBe('completed')
      expect(service.getTrace(t.traceId)!.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('ends trace with error status', () => {
      const t = service.startTrace('api', 'request')
      service.endTrace(t.traceId, 'error')
      expect(service.getTrace(t.traceId)!.status).toBe('error')
    })

    it('lists traces', () => {
      service.startTrace('a', 'op1')
      service.startTrace('b', 'op2')
      expect(service.getTraces().length).toBe(2)
    })
  })

  describe('Span management', () => {
    it('starts child spans', () => {
      const t = service.startTrace('api', 'request')
      const span = service.startSpan(t.traceId, 'db-query', 'postgres')
      expect(span).not.toBeNull()
      expect(span!.parentSpanId).toBe(t.rootSpanId)
      expect(service.getTrace(t.traceId)!.spanCount).toBe(2)
    })

    it('ends a span', () => {
      const t = service.startTrace('api', 'request')
      const span = service.startSpan(t.traceId, 'db-query', 'postgres')!
      expect(service.endSpan(span.spanId)).toBe(true)
      expect(service.getSpan(span.spanId)!.status).toBe('completed')
    })

    it('gets trace spans', () => {
      const t = service.startTrace('api', 'request')
      service.startSpan(t.traceId, 'auth', 'auth-service')
      service.startSpan(t.traceId, 'db', 'postgres')
      expect(service.getTraceSpans(t.traceId).length).toBe(3) // root + 2
    })

    it('gets child spans', () => {
      const t = service.startTrace('api', 'request')
      service.startSpan(t.traceId, 'child1', 'svc')
      service.startSpan(t.traceId, 'child2', 'svc')
      expect(service.getChildSpans(t.rootSpanId).length).toBe(2)
    })

    it('returns null for unknown trace', () => {
      expect(service.startSpan('unknown', 'op', 'svc')).toBeNull()
    })
  })

  describe('Tags and logs', () => {
    it('adds tags to span', () => {
      const t = service.startTrace('api', 'request')
      expect(service.addSpanTag(t.rootSpanId, 'http.method', 'GET')).toBe(true)
      expect(service.getSpan(t.rootSpanId)!.tags['http.method']).toBe('GET')
    })

    it('adds logs to span', () => {
      const t = service.startTrace('api', 'request')
      expect(service.addSpanLog(t.rootSpanId, 'info', 'Processing request')).toBe(true)
      expect(service.getSpan(t.rootSpanId)!.logs.length).toBe(1)
    })
  })

  describe('Search', () => {
    beforeEach(() => {
      const t1 = service.startTrace('api', 'GET /users', { env: 'prod' })
      service.endTrace(t1.traceId)
      const t2 = service.startTrace('api', 'POST /users', { env: 'prod' })
      service.endTrace(t2.traceId, 'error')
      service.startTrace('worker', 'process-job', { env: 'staging' })
    })

    it('searches by service name', () => {
      expect(service.searchTraces({ serviceName: 'api' }).length).toBe(2)
    })

    it('searches by status', () => {
      expect(service.searchTraces({ status: 'error' }).length).toBe(1)
    })

    it('searches by tags', () => {
      expect(service.searchTraces({ tags: { env: 'staging' } }).length).toBe(1)
    })

    it('limits results', () => {
      expect(service.searchTraces({ limit: 1 }).length).toBe(1)
    })
  })

  describe('Bottleneck detection', () => {
    it('detects slowest spans', () => {
      const t = service.startTrace('api', 'request')
      const s1 = service.startSpan(t.traceId, 'fast-op', 'svc')!
      service.endSpan(s1.spanId)
      const s2 = service.startSpan(t.traceId, 'slow-op', 'db')!
      // Manually set duration for testing
      const span = service.getSpan(s2.spanId)!
      span.endTime = new Date().toISOString()
      span.durationMs = 500
      service.endTrace(t.traceId)

      const report = service.detectBottlenecks(t.traceId)
      expect(report).not.toBeNull()
      expect(report!.slowestSpans.length).toBeGreaterThan(0)
      expect(report!.criticalPath.length).toBeGreaterThan(0)
    })

    it('returns null for unknown trace', () => {
      expect(service.detectBottlenecks('unknown')).toBeNull()
    })
  })
})
