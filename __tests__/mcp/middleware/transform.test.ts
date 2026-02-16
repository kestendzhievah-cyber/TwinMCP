import {
  TransformPipeline,
  correlationIdTransformer,
  envelopeTransformer,
  createRedactionTransformer,
  createDefaultPipeline,
  TransformContext,
} from '../../../lib/mcp/middleware/transform'

function makeCtx(overrides: Partial<TransformContext> = {}): TransformContext {
  return {
    requestId: 'req-123',
    userId: 'user-1',
    apiVersion: 'v1',
    metadata: {},
    ...overrides,
  }
}

describe('TransformPipeline', () => {
  let pipeline: TransformPipeline

  beforeEach(() => {
    pipeline = new TransformPipeline()
  })

  describe('Rule management', () => {
    it('adds and retrieves rules', () => {
      pipeline.addRule({
        id: 'r1',
        name: 'Rule 1',
        pathPattern: '**',
        priority: 10,
        enabled: true,
      })
      expect(pipeline.getRules().length).toBe(1)
    })

    it('removes rules', () => {
      pipeline.addRule({
        id: 'r1',
        name: 'Rule 1',
        pathPattern: '**',
        priority: 10,
        enabled: true,
      })
      expect(pipeline.removeRule('r1')).toBe(true)
      expect(pipeline.getRules().length).toBe(0)
    })

    it('sorts rules by priority', () => {
      pipeline.addRule({ id: 'low', name: 'Low', pathPattern: '**', priority: 100, enabled: true })
      pipeline.addRule({ id: 'high', name: 'High', pathPattern: '**', priority: 1, enabled: true })
      const rules = pipeline.getRules()
      expect(rules[0].id).toBe('high')
      expect(rules[1].id).toBe('low')
    })
  })

  describe('Request transformation', () => {
    it('applies matching request transformers', () => {
      pipeline.addRule({
        id: 'add-header',
        name: 'Add Header',
        pathPattern: '/api/**',
        priority: 0,
        enabled: true,
        requestTransform: (body, headers, ctx) => ({
          body,
          headers: { ...headers, 'x-custom': 'value' },
        }),
      })

      const result = pipeline.transformRequest('/api/test', {}, {}, makeCtx())
      expect(result.headers['x-custom']).toBe('value')
    })

    it('skips disabled rules', () => {
      pipeline.addRule({
        id: 'disabled',
        name: 'Disabled',
        pathPattern: '**',
        priority: 0,
        enabled: false,
        requestTransform: (body, headers) => ({
          body: { ...body, injected: true },
          headers,
        }),
      })

      const result = pipeline.transformRequest('/test', { original: true }, {}, makeCtx())
      expect(result.body.injected).toBeUndefined()
    })

    it('skips non-matching paths', () => {
      pipeline.addRule({
        id: 'api-only',
        name: 'API Only',
        pathPattern: '/api/**',
        priority: 0,
        enabled: true,
        requestTransform: (body, headers) => ({
          body: { ...body, apiOnly: true },
          headers,
        }),
      })

      const result = pipeline.transformRequest('/other/path', {}, {}, makeCtx())
      expect(result.body.apiOnly).toBeUndefined()
    })
  })

  describe('Response transformation', () => {
    it('applies matching response transformers', () => {
      pipeline.addRule({
        id: 'wrap',
        name: 'Wrap',
        pathPattern: '**',
        priority: 0,
        enabled: true,
        responseTransform: (body, status, ctx) => ({
          body: { wrapped: true, data: body },
          statusCode: status,
        }),
      })

      const result = pipeline.transformResponse('/test', { foo: 'bar' }, 200, makeCtx())
      expect(result.body.wrapped).toBe(true)
      expect(result.body.data.foo).toBe('bar')
    })
  })
})

describe('Built-in Transformers', () => {
  it('correlationIdTransformer adds x-correlation-id header', () => {
    const result = correlationIdTransformer({}, {}, makeCtx({ requestId: 'abc-123' }))
    expect(result.headers['x-correlation-id']).toBe('abc-123')
  })

  it('envelopeTransformer wraps response in standard envelope', () => {
    const result = envelopeTransformer({ items: [1, 2] }, 200, makeCtx())
    expect(result.body.success).toBe(true)
    expect(result.body.data.items).toEqual([1, 2])
    expect(result.body.meta.requestId).toBe('req-123')
  })

  it('envelopeTransformer marks error responses', () => {
    const result = envelopeTransformer({ error: 'fail' }, 500, makeCtx())
    expect(result.body.success).toBe(false)
  })

  it('createRedactionTransformer redacts specified fields', () => {
    const redact = createRedactionTransformer(['password', 'secret'])
    const result = redact(
      { user: 'alice', password: 'hunter2', nested: { secret: 'key' } },
      200,
      makeCtx()
    )
    expect(result.body.password).toBe('[REDACTED]')
    expect(result.body.nested.secret).toBe('[REDACTED]')
    expect(result.body.user).toBe('alice')
  })

  it('createDefaultPipeline has correlation-id and redact-secrets rules', () => {
    const pipeline = createDefaultPipeline()
    const rules = pipeline.getRules()
    expect(rules.find(r => r.id === 'correlation-id')).toBeDefined()
    expect(rules.find(r => r.id === 'redact-secrets')).toBeDefined()
  })
})
