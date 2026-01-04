import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { registry } from '../../../lib/mcp/core/registry'
import { EmailTool } from '../../../lib/mcp/tools/communication/email'
import { SlackTool } from '../../../lib/mcp/tools/communication/slack'

describe('MCP Registry', () => {
  beforeEach(() => {
    registry.clear()
  })

  afterEach(() => {
    registry.clear()
  })

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      const emailTool = new EmailTool()

      registry.register(emailTool)

      expect(registry.exists('email')).toBe(true)
      expect(registry.get('email')).toBe(emailTool)
    })

    it('should unregister a tool', () => {
      const emailTool = new EmailTool()

      registry.register(emailTool)
      expect(registry.exists('email')).toBe(true)

      registry.unregister('email')
      expect(registry.exists('email')).toBe(false)
    })

    it('should prevent duplicate registration', () => {
      const emailTool1 = new EmailTool()
      const emailTool2 = new EmailTool()

      registry.register(emailTool1)

      expect(() => {
        registry.register(emailTool2)
      }).toThrow('Tool with id \'email\' already exists')
    })

    it('should validate tool before registration', () => {
      const invalidTool = {
        id: 'invalid',
        name: '',
        version: '1.0.0',
        category: 'communication' as const,
        description: 'Invalid tool',
        author: 'Test',
        tags: ['test'],
        requiredConfig: ['test'],
        optionalConfig: [],
        inputSchema: {},
        validate: () => Promise.resolve({ success: true }),
        execute: () => Promise.resolve({ success: true }),
        capabilities: {
          async: false,
          batch: false,
          streaming: false,
          webhook: false
        }
      }

      expect(() => {
        registry.register(invalidTool as any)
      }).toThrow()
    })
  })

  describe('Tool Search', () => {
    beforeEach(() => {
      registry.register(new EmailTool())
      registry.register(new SlackTool())
    })

    it('should find tools by category', () => {
      const communicationTools = registry.getByCategory('communication')
      expect(communicationTools.length).toBe(2)
      expect(communicationTools.every(t => t.category === 'communication')).toBe(true)
    })

    it('should search tools by query', () => {
      const results = registry.search('email')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(t => t.id === 'email')).toBe(true)
    })

    it('should filter tools by capabilities', () => {
      const asyncTools = registry.search('', {
        capabilities: { async: true }
      })
      expect(asyncTools.every(t => t.capabilities.async)).toBe(true)
    })

    it('should filter tools by rate limit', () => {
      const rateLimitedTools = registry.search('', {
        hasRateLimit: true
      })
      expect(rateLimitedTools.every(t => !!t.rateLimit)).toBe(true)
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      registry.register(new EmailTool())
      registry.register(new SlackTool())
    })

    it('should provide accurate statistics', () => {
      const stats = registry.getStats()

      expect(stats.totalTools).toBe(2)
      expect(stats.toolsByCategory.communication).toBe(2)
      expect(stats.toolsWithRateLimit).toBe(2)
      expect(stats.toolsWithCache).toBe(2)
      expect(stats.asyncTools).toBe(0)
    })
  })

  describe('Plugin System', () => {
    it('should load plugin tools', () => {
      const mockPlugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin',
        tools: [new EmailTool()],
        dependencies: [],
        config: {}
      }

      registry.loadPlugin(mockPlugin)

      expect(registry.exists('email')).toBe(true)
      expect(registry.getPlugins().length).toBe(1)
    })

    it('should handle plugin dependencies', () => {
      const plugin1 = {
        id: 'plugin1',
        name: 'Plugin 1',
        version: '1.0.0',
        description: 'First plugin',
        tools: [],
        dependencies: [],
        config: {}
      }

      const plugin2 = {
        id: 'plugin2',
        name: 'Plugin 2',
        version: '1.0.0',
        description: 'Second plugin',
        tools: [new EmailTool()],
        dependencies: ['plugin1'],
        config: {}
      }

      registry.loadPlugin(plugin1)

      expect(() => {
        registry.loadPlugin(plugin2)
      }).not.toThrow()

      expect(registry.exists('email')).toBe(true)
    })
  })
})
