/**
 * Load tests for MCP system.
 * Tests concurrent tool execution, batch throughput, and registry under pressure.
 */
import { ToolExecutor } from '../../../lib/mcp/core/tool-executor'
import { MCPTool, ExecutionResult } from '../../../lib/mcp/core/types'
import { MCPRegistry } from '../../../lib/mcp/core/registry'
import { getCircuitBreaker } from '../../../lib/mcp/core/circuit-breaker'

function makeTool(id: string, latencyMs: number = 0): MCPTool {
  return {
    id,
    name: `load-tool-${id}`,
    description: `Load test tool ${id}`,
    category: 'data',
    version: '1.0.0',
    inputSchema: {} as any,
    capabilities: { async: false, streaming: false, batch: false, webhook: false },
    rateLimit: { requests: 10000, period: '1m', strategy: 'sliding-window' },
    validate: jest.fn().mockResolvedValue({ success: true, errors: [] }),
    execute: jest.fn().mockImplementation(async () => {
      if (latencyMs > 0) await new Promise(r => setTimeout(r, latencyMs))
      return {
        success: true,
        data: { id, ts: Date.now() },
        metadata: { executionTime: latencyMs, cacheHit: false, apiCallsCount: 1 },
      }
    }),
  } as unknown as MCPTool
}

describe('MCP Load Tests', () => {
  let executor: ToolExecutor

  beforeEach(() => {
    getCircuitBreaker().resetAll()
    executor = new ToolExecutor()
  })

  it('handles 100 sequential executions without errors', async () => {
    const tool = makeTool('seq-100')
    const results: ExecutionResult[] = []

    for (let i = 0; i < 100; i++) {
      results.push(
        await executor.execute(tool, { i }, {}, { skipSecurity: true, skipRateLimit: true })
      )
    }

    const successes = results.filter(r => r.success)
    expect(successes.length).toBe(100)
  }, 15000)

  it('handles 50 concurrent executions via batch', async () => {
    const tool = makeTool('batch-50', 5) // 5ms simulated latency

    const requests = Array.from({ length: 50 }, (_, i) => ({
      tool,
      args: { i },
      config: {},
      options: { skipSecurity: true, skipRateLimit: true } as any,
    }))

    const results = await executor.executeBatch(requests, 10)

    expect(results.length).toBe(50)
    expect(results.every(r => r.success)).toBe(true)
  }, 15000)

  it('batch execution respects concurrency limit', async () => {
    let maxConcurrent = 0
    let currentConcurrent = 0

    const tool = makeTool('concurrency-check')
    ;(tool.execute as jest.Mock).mockImplementation(async () => {
      currentConcurrent++
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      await new Promise(r => setTimeout(r, 20))
      currentConcurrent--
      return {
        success: true,
        data: {},
        metadata: { executionTime: 20, cacheHit: false, apiCallsCount: 1 },
      }
    })

    const requests = Array.from({ length: 20 }, (_, i) => ({
      tool,
      args: { i },
      config: {},
      options: { skipSecurity: true, skipRateLimit: true } as any,
    }))

    await executor.executeBatch(requests, 3)

    expect(maxConcurrent).toBeLessThanOrEqual(3)
  }, 15000)

  it('handles mixed success/failure under load', async () => {
    let callCount = 0
    const tool = makeTool('mixed-load')
    ;(tool.execute as jest.Mock).mockImplementation(async () => {
      callCount++
      if (callCount % 5 === 0) {
        return {
          success: false,
          error: 'Simulated failure',
          metadata: { executionTime: 1, cacheHit: false, apiCallsCount: 1 },
        }
      }
      return {
        success: true,
        data: { n: callCount },
        metadata: { executionTime: 1, cacheHit: false, apiCallsCount: 1 },
      }
    })

    const requests = Array.from({ length: 30 }, (_, i) => ({
      tool,
      args: { i },
      config: {},
      options: { skipSecurity: true, skipRateLimit: true } as any,
    }))

    const results = await executor.executeBatch(requests, 5)

    const successes = results.filter(r => r.success).length
    const failures = results.filter(r => !r.success).length

    expect(successes + failures).toBe(30)
    expect(failures).toBeGreaterThan(0)
    expect(successes).toBeGreaterThan(failures)
  }, 15000)

  it('registry handles 200 tool registrations', () => {
    const registry = new MCPRegistry()

    for (let i = 0; i < 200; i++) {
      const tool = makeTool(`reg-${i}`)
      registry.register(tool)
    }

    expect(registry.getAll().length).toBe(200)
    expect(registry.get('reg-0')).toBeDefined()
    expect(registry.get('reg-199')).toBeDefined()
  })

  it('circuit breaker stays CLOSED under normal load', async () => {
    const tool = makeTool('cb-normal')
    const cb = getCircuitBreaker()

    for (let i = 0; i < 20; i++) {
      await executor.execute(tool, { i }, {}, { skipSecurity: true, skipRateLimit: true })
    }

    expect(cb.getState(tool.id)).toBe('CLOSED')
  })

  it('throughput: 100 batch executions complete in < 5s', async () => {
    const tool = makeTool('throughput', 1)

    const requests = Array.from({ length: 100 }, (_, i) => ({
      tool,
      args: { i },
      config: {},
      options: { skipSecurity: true, skipRateLimit: true } as any,
    }))

    const start = Date.now()
    const results = await executor.executeBatch(requests, 20)
    const elapsed = Date.now() - start

    expect(results.length).toBe(100)
    expect(results.every(r => r.success)).toBe(true)
    expect(elapsed).toBeLessThan(5000)
  }, 10000)
})
