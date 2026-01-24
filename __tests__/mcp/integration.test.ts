import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { initializeMCP, shutdownMCP } from '../../lib/mcp/init'
import { registry } from '../../lib/mcp/tools'
import { validator } from '../../lib/mcp/core/validator'

/**
 * MCP Integration Tests
 * 
 * Ces tests vérifient le fonctionnement du système MCP sans serveur HTTP.
 * Ils testent directement les composants: registry, validator, tools.
 */

describe('MCP API Integration', () => {
  beforeAll(async () => {
    // Clear registry before initialization to avoid duplicates between test runs
    registry.clear()
    await initializeMCP()
  }, 30000)

  afterAll(async () => {
    await shutdownMCP()
  })

  describe('Registry', () => {
    it('should have tools registered after initialization', () => {
      const tools = registry.getAll()
      expect(tools).toBeDefined()
      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)
    })

    it('should get tool by id', () => {
      const emailTool = registry.get('email')
      expect(emailTool).toBeDefined()
      expect(emailTool?.id).toBe('email')
      expect(emailTool?.category).toBe('communication')
    })

    it('should get tools by category', () => {
      const communicationTools = registry.getByCategory('communication')
      expect(communicationTools).toBeDefined()
      expect(communicationTools.length).toBeGreaterThan(0)
      expect(communicationTools.every(t => t.category === 'communication')).toBe(true)
    })

    it('should search tools by query', () => {
      const results = registry.search('email')
      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    it('should return registry stats', () => {
      const stats = registry.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalTools).toBeGreaterThan(0)
      expect(stats.toolsByCategory).toBeDefined()
    })
  })

  describe('Tool Validation', () => {
    it('should validate correct email args', async () => {
      const emailTool = registry.get('email')
      expect(emailTool).toBeDefined()

      const result = await emailTool!.validate({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body content'
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should reject invalid email format', async () => {
      const emailTool = registry.get('email')
      expect(emailTool).toBeDefined()

      const result = await emailTool!.validate({
        to: 'invalid-email',
        subject: 'Test Subject',
        body: 'Test body'
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it('should reject missing required fields', async () => {
      const emailTool = registry.get('email')
      expect(emailTool).toBeDefined()

      const result = await emailTool!.validate({
        to: 'test@example.com'
        // missing subject and body
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('Tool Structure', () => {
    it('should have required properties on all tools', () => {
      const tools = registry.getAll()

      for (const tool of tools) {
        expect(tool.id).toBeDefined()
        expect(tool.name).toBeDefined()
        expect(tool.version).toBeDefined()
        expect(tool.category).toBeDefined()
        expect(tool.description).toBeDefined()
        expect(tool.inputSchema).toBeDefined()
        expect(typeof tool.validate).toBe('function')
        expect(typeof tool.execute).toBe('function')
      }
    })

    it('should have valid categories', () => {
      const validCategories = ['communication', 'productivity', 'development', 'data']
      const tools = registry.getAll()

      for (const tool of tools) {
        expect(validCategories).toContain(tool.category)
      }
    })

    it('should have capabilities defined', () => {
      const tools = registry.getAll()

      for (const tool of tools) {
        expect(tool.capabilities).toBeDefined()
        expect(typeof tool.capabilities.async).toBe('boolean')
        expect(typeof tool.capabilities.batch).toBe('boolean')
        expect(typeof tool.capabilities.streaming).toBe('boolean')
        expect(typeof tool.capabilities.webhook).toBe('boolean')
      }
    })
  })

  describe('Validator', () => {
    it('should validate using tool validate method', async () => {
      const emailTool = registry.get('email')
      expect(emailTool).toBeDefined()

      const result = await emailTool!.validate({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test body'
      })

      expect(result.success).toBe(true)
    })

    it('should reject invalid data using tool validate method', async () => {
      const emailTool = registry.get('email')
      expect(emailTool).toBeDefined()

      const result = await emailTool!.validate({
        to: 'not-an-email',
        subject: 'Test',
        body: 'Test body'
      })

      expect(result.success).toBe(false)
    })

    it('should return error for unknown tool schema', async () => {
      const result = await validator.validate('unknown-tool', {})
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })
})
