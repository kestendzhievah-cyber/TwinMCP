import { describe, it, expect, beforeEach } from '@jest/globals'
import { MCPRegistry } from '../../../lib/mcp/core/registry'
import { MCPTool, ValidationResult, ExecutionResult } from '../../../lib/mcp/core/types'
import { z } from 'zod'

function createMockTool(id: string, version: string = '1.0.0', category: 'communication' | 'productivity' | 'development' | 'data' = 'development'): MCPTool {
  return {
    id,
    name: `Tool ${id}`,
    version,
    category,
    description: `Mock tool ${id}`,
    tags: ['test'],
    requiredConfig: [],
    inputSchema: z.object({ input: z.string() }),
    capabilities: { async: false, batch: false, streaming: false, webhook: false },
    async validate(args: any): Promise<ValidationResult> {
      return { success: true, data: args }
    },
    async execute(args: any): Promise<ExecutionResult> {
      return { success: true, data: args }
    }
  }
}

describe('MCPRegistry Advanced Features', () => {
  let registry: MCPRegistry

  beforeEach(() => {
    registry = new MCPRegistry()
  })

  describe('Hot-reload (registerOrReplace)', () => {
    it('should register a new tool', () => {
      const tool = createMockTool('test-tool', '1.0.0')
      const result = registry.registerOrReplace(tool)

      expect(result.replaced).toBe(false)
      expect(result.previousVersion).toBeUndefined()
      expect(registry.exists('test-tool')).toBe(true)
    })

    it('should replace an existing tool', () => {
      const toolV1 = createMockTool('test-tool', '1.0.0')
      const toolV2 = createMockTool('test-tool', '2.0.0')

      registry.registerOrReplace(toolV1)
      const result = registry.registerOrReplace(toolV2)

      expect(result.replaced).toBe(true)
      expect(result.previousVersion).toBe('1.0.0')
      expect(registry.get('test-tool')?.version).toBe('2.0.0')
    })

    it('should update category index when category changes', () => {
      const toolDev = createMockTool('test-tool', '1.0.0', 'development')
      const toolData = createMockTool('test-tool', '2.0.0', 'data')

      registry.registerOrReplace(toolDev)
      expect(registry.getByCategory('development')).toHaveLength(1)

      registry.registerOrReplace(toolData)
      expect(registry.getByCategory('development')).toHaveLength(0)
      expect(registry.getByCategory('data')).toHaveLength(1)
    })

    it('should not increase tool count on replace', () => {
      const toolV1 = createMockTool('test-tool', '1.0.0')
      const toolV2 = createMockTool('test-tool', '2.0.0')

      registry.registerOrReplace(toolV1)
      expect(registry.getStats().totalTools).toBe(1)

      registry.registerOrReplace(toolV2)
      expect(registry.getStats().totalTools).toBe(1)
    })
  })

  describe('Version Conflict Detection', () => {
    it('should detect version conflict', () => {
      const tool = createMockTool('test-tool', '1.0.0')
      registry.register(tool)

      expect(registry.hasVersionConflict('test-tool', '2.0.0')).toBe(true)
    })

    it('should not detect conflict for same version', () => {
      const tool = createMockTool('test-tool', '1.0.0')
      registry.register(tool)

      expect(registry.hasVersionConflict('test-tool', '1.0.0')).toBe(false)
    })

    it('should not detect conflict for non-existent tool', () => {
      expect(registry.hasVersionConflict('non-existent', '1.0.0')).toBe(false)
    })
  })

  describe('Max Tools Limit', () => {
    it('should throw when registry is full via register()', () => {
      // Access private maxTools via any cast for testing
      ;(registry as any).maxTools = 3

      registry.register(createMockTool('tool-1'))
      registry.register(createMockTool('tool-2'))
      registry.register(createMockTool('tool-3'))

      expect(() => {
        registry.register(createMockTool('tool-4'))
      }).toThrow('Registry is full')
    })

    it('should throw when registry is full via registerOrReplace() for new tool', () => {
      ;(registry as any).maxTools = 2

      registry.registerOrReplace(createMockTool('tool-1'))
      registry.registerOrReplace(createMockTool('tool-2'))

      expect(() => {
        registry.registerOrReplace(createMockTool('tool-3'))
      }).toThrow('Registry is full')
    })

    it('should allow replace even when registry is full', () => {
      ;(registry as any).maxTools = 2

      registry.registerOrReplace(createMockTool('tool-1', '1.0.0'))
      registry.registerOrReplace(createMockTool('tool-2', '1.0.0'))

      // Replace existing tool should work even at capacity
      expect(() => {
        registry.registerOrReplace(createMockTool('tool-1', '2.0.0'))
      }).not.toThrow()

      expect(registry.get('tool-1')?.version).toBe('2.0.0')
    })
  })

  describe('Plugin Management', () => {
    it('should load and unload plugins', () => {
      const plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        tools: [
          createMockTool('plugin-tool-1'),
          createMockTool('plugin-tool-2')
        ]
      }

      registry.loadPlugin(plugin)
      expect(registry.getPlugins()).toHaveLength(1)
      expect(registry.exists('plugin-tool-1')).toBe(true)
      expect(registry.exists('plugin-tool-2')).toBe(true)

      registry.unloadPlugin('test-plugin')
      expect(registry.getPlugins()).toHaveLength(0)
      expect(registry.exists('plugin-tool-1')).toBe(false)
      expect(registry.exists('plugin-tool-2')).toBe(false)
    })

    it('should reject duplicate plugin', () => {
      const plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        tools: [createMockTool('plugin-tool')]
      }

      registry.loadPlugin(plugin)
      expect(() => registry.loadPlugin(plugin)).toThrow("Plugin 'test-plugin' already loaded")
    })
  })

  describe('Export Config', () => {
    it('should export registry configuration', () => {
      registry.register(createMockTool('tool-1', '1.0.0', 'development'))
      registry.register(createMockTool('tool-2', '2.0.0', 'communication'))

      const config = registry.exportConfig()

      expect(config.tools).toHaveLength(2)
      expect(config.stats.totalTools).toBe(2)
      expect(config.tools[0].id).toBe('tool-1')
      expect(config.tools[1].id).toBe('tool-2')
    })
  })
})
