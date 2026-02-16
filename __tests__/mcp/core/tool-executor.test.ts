import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals'
import { ToolExecutor, getToolExecutor } from '../../../lib/mcp/core/tool-executor'
import { MCPRegistry } from '../../../lib/mcp/core/registry'
import { MCPTool, ValidationResult, ExecutionResult } from '../../../lib/mcp/core/types'
import { z } from 'zod'

// Minimal mock tool for testing
function createMockTool(overrides: Partial<MCPTool> = {}): MCPTool {
  return {
    id: 'mock-tool',
    name: 'Mock Tool',
    version: '1.0.0',
    category: 'development' as const,
    description: 'A mock tool for testing',
    tags: ['test'],
    requiredConfig: [],
    inputSchema: z.object({
      input: z.string().min(1)
    }),
    capabilities: { async: false, batch: false, streaming: false, webhook: false },
    async validate(args: any): Promise<ValidationResult> {
      try {
        const data = z.object({ input: z.string().min(1) }).parse(args)
        return { success: true, data }
      } catch (error: any) {
        return {
          success: false,
          errors: error.errors?.map((e: any) => ({ path: e.path.join('.'), message: e.message })) || [{ path: 'unknown', message: 'Validation failed' }]
        }
      }
    },
    async execute(args: any, config: any): Promise<ExecutionResult> {
      return {
        success: true,
        data: { echo: args.input },
        metadata: { executionTime: 1, cacheHit: false, apiCallsCount: 1 }
      }
    },
    ...overrides
  }
}

describe('ToolExecutor', () => {
  let executor: ToolExecutor

  beforeAll(() => {
    executor = new ToolExecutor()
  })

  describe('Basic Execution', () => {
    it('should execute a tool successfully', async () => {
      const tool = createMockTool()
      const result = await executor.execute(tool, { input: 'hello' }, {}, { skipRateLimit: true, skipSecurity: true })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ echo: 'hello' })
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('should return validation error for invalid args', async () => {
      const tool = createMockTool()
      const result = await executor.execute(tool, { input: '' }, {}, { skipRateLimit: true, skipSecurity: true })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid input parameters')
    })

    it('should return validation error for missing args', async () => {
      const tool = createMockTool()
      const result = await executor.execute(tool, {}, {}, { skipRateLimit: true, skipSecurity: true })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid input parameters')
    })
  })

  describe('Hooks', () => {
    it('should call beforeExecute hook', async () => {
      let hookCalled = false
      const tool = createMockTool({
        async beforeExecute(args: any) {
          hookCalled = true
          return args
        }
      })

      await executor.execute(tool, { input: 'test' }, {}, { skipRateLimit: true, skipSecurity: true })
      expect(hookCalled).toBe(true)
    })

    it('should call afterExecute hook', async () => {
      let hookCalled = false
      const tool = createMockTool({
        async afterExecute(result: ExecutionResult) {
          hookCalled = true
          return result
        }
      })

      await executor.execute(tool, { input: 'test' }, {}, { skipRateLimit: true, skipSecurity: true })
      expect(hookCalled).toBe(true)
    })

    it('should call onError hook on execution failure', async () => {
      let errorHookCalled = false
      const tool = createMockTool({
        async execute() {
          throw new Error('Intentional failure')
        },
        async onError(error: Error) {
          errorHookCalled = true
        }
      })

      const result = await executor.execute(tool, { input: 'test' }, {}, { skipRateLimit: true, skipSecurity: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Intentional failure')
      expect(errorHookCalled).toBe(true)
    })

    it('should allow beforeExecute to transform args', async () => {
      const tool = createMockTool({
        async beforeExecute(args: any) {
          return { ...args, input: args.input.toUpperCase() }
        }
      })

      const result = await executor.execute(tool, { input: 'hello' }, {}, { skipRateLimit: true, skipSecurity: true })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ echo: 'HELLO' })
    })
  })

  describe('Security Validation', () => {
    it('should reject XSS attempts when security is enabled', async () => {
      const tool = createMockTool({
        inputSchema: z.object({ input: z.string() }),
        async validate(args: any) {
          return { success: true, data: args }
        }
      })

      const result = await executor.execute(
        tool,
        { input: '<script>alert("xss")</script>' },
        {},
        { skipRateLimit: true }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Security validation failed')
    })

    it('should reject SQL injection attempts when security is enabled', async () => {
      const tool = createMockTool({
        inputSchema: z.object({ input: z.string() }),
        async validate(args: any) {
          return { success: true, data: args }
        }
      })

      const result = await executor.execute(
        tool,
        { input: "'; DROP TABLE users; --" },
        {},
        { skipRateLimit: true }
      )

      // The SQL injection pattern "'; --" should be caught
      expect(result.success).toBe(false)
    })

    it('should skip security when option is set', async () => {
      const tool = createMockTool({
        inputSchema: z.object({ input: z.string() }),
        async validate(args: any) {
          return { success: true, data: args }
        }
      })

      const result = await executor.execute(
        tool,
        { input: '<script>alert("xss")</script>' },
        {},
        { skipRateLimit: true, skipSecurity: true }
      )

      expect(result.success).toBe(true)
    })
  })

  describe('Batch Execution', () => {
    it('should execute multiple tools in batch', async () => {
      const tool = createMockTool()

      const results = await executor.executeBatch([
        { tool, args: { input: 'one' }, options: { skipRateLimit: true, skipSecurity: true } },
        { tool, args: { input: 'two' }, options: { skipRateLimit: true, skipSecurity: true } },
        { tool, args: { input: 'three' }, options: { skipRateLimit: true, skipSecurity: true } }
      ])

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[0].data).toEqual({ echo: 'one' })
      expect(results[1].data).toEqual({ echo: 'two' })
      expect(results[2].data).toEqual({ echo: 'three' })
    })

    it('should handle mixed success/failure in batch', async () => {
      const tool = createMockTool()

      const results = await executor.executeBatch([
        { tool, args: { input: 'valid' }, options: { skipRateLimit: true, skipSecurity: true } },
        { tool, args: { input: '' }, options: { skipRateLimit: true, skipSecurity: true } },
        { tool, args: { input: 'also-valid' }, options: { skipRateLimit: true, skipSecurity: true } }
      ])

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })

    it('should respect concurrency limit', async () => {
      let maxConcurrent = 0
      let currentConcurrent = 0

      const tool = createMockTool({
        async execute(args: any) {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          await new Promise(resolve => setTimeout(resolve, 50))
          currentConcurrent--
          return { success: true, data: { echo: args.input }, metadata: { executionTime: 50, cacheHit: false, apiCallsCount: 1 } }
        }
      })

      const requests = Array.from({ length: 10 }, (_, i) => ({
        tool,
        args: { input: `item-${i}` },
        options: { skipRateLimit: true, skipSecurity: true } as any
      }))

      await executor.executeBatch(requests, 3)

      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })
  })

  describe('Singleton', () => {
    it('should return same instance from getToolExecutor', () => {
      const a = getToolExecutor()
      const b = getToolExecutor()
      expect(a).toBe(b)
    })
  })
})
