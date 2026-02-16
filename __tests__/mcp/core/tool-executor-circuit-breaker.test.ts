import { ToolExecutor } from '../../../lib/mcp/core/tool-executor'
import { CircuitBreakerRegistry, getCircuitBreaker } from '../../../lib/mcp/core/circuit-breaker'
import { MCPTool, ExecutionResult } from '../../../lib/mcp/core/types'

function makeTool(overrides: Partial<MCPTool> = {}): MCPTool {
  return {
    id: 'test-tool',
    name: 'Test Tool',
    description: 'A test tool',
    category: 'test',
    version: '1.0.0',
    inputSchema: {} as any,
    capabilities: { async: false, streaming: false, batch: false, webhook: false },
    rateLimit: { requests: 100, period: '1m', strategy: 'sliding-window' },
    validate: jest.fn().mockResolvedValue({ success: true, errors: [] }),
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: { result: 'ok' },
      metadata: { executionTime: 10, cacheHit: false, apiCallsCount: 1 },
    }),
    ...overrides,
  } as unknown as MCPTool
}

describe('ToolExecutor — Circuit Breaker Integration', () => {
  let executor: ToolExecutor

  beforeEach(() => {
    // Reset the global circuit breaker between tests
    getCircuitBreaker().resetAll()
    executor = new ToolExecutor()
  })

  it('allows execution when circuit is CLOSED', async () => {
    const tool = makeTool()
    const result = await executor.execute(tool, {}, {}, { skipSecurity: true, skipRateLimit: true })
    expect(result.success).toBe(true)
  })

  it('blocks execution when circuit is OPEN after repeated failures', async () => {
    const failingTool = makeTool({
      execute: jest.fn().mockRejectedValue(new Error('Service down')),
    })

    const cb = getCircuitBreaker()

    // Manually trip the breaker (default threshold is 5)
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('test-tool')
    }

    const result = await executor.execute(failingTool, {}, {}, { skipSecurity: true, skipRateLimit: true })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Circuit breaker OPEN')
  })

  it('records failure in circuit breaker when tool execution throws', async () => {
    const failingTool = makeTool({
      execute: jest.fn().mockRejectedValue(new Error('Boom')),
    })

    const cb = getCircuitBreaker()

    const result = await executor.execute(failingTool, {}, {}, { skipSecurity: true, skipRateLimit: true })
    expect(result.success).toBe(false)
    expect(cb.getState('test-tool')).toBe('CLOSED') // 1 failure < threshold
  })

  it('records failure when tool returns success: false', async () => {
    const softFailTool = makeTool({
      execute: jest.fn().mockResolvedValue({
        success: false,
        error: 'Soft failure',
        metadata: { executionTime: 5, cacheHit: false, apiCallsCount: 1 },
      }),
    })

    const cb = getCircuitBreaker()

    await executor.execute(softFailTool, {}, {}, { skipSecurity: true, skipRateLimit: true })
    await executor.execute(softFailTool, {}, {}, { skipSecurity: true, skipRateLimit: true })

    const stats = cb.getStats()
    const toolStats = stats.find(s => s.key === 'test-tool')
    expect(toolStats?.failures).toBe(2)
  })

  it('records success and resets circuit breaker on successful execution', async () => {
    const cb = getCircuitBreaker()

    // Add some failures first
    cb.recordFailure('test-tool')
    cb.recordFailure('test-tool')

    const tool = makeTool()
    await executor.execute(tool, {}, {}, { skipSecurity: true, skipRateLimit: true })

    const stats = cb.getStats()
    const toolStats = stats.find(s => s.key === 'test-tool')
    expect(toolStats?.failures).toBe(0)
    expect(toolStats?.state).toBe('CLOSED')
  })
})
