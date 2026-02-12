import { describe, it, expect, beforeAll, jest } from '@jest/globals'
import { EmailTool } from '../../../lib/mcp/tools/communication/email'

describe('EmailTool', () => {
  let emailTool: EmailTool

  beforeAll(() => {
    emailTool = new EmailTool()
  })

  describe('Validation', () => {
    it('should validate correct email arguments', async () => {
      const args = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body content'
      }

      const result = await emailTool.validate(args)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(args)
    })

    it('should reject invalid email format', async () => {
      const args = {
        to: 'invalid-email',
        subject: 'Test Subject',
        body: 'Test body content'
      }

      const result = await emailTool.validate(args)
      expect(result.success).toBe(false)
      expect(result.errors?.some(e => e.message.includes('Invalid email format'))).toBe(true)
    })

    it('should reject missing required fields', async () => {
      const args = {
        to: 'test@example.com'
        // missing subject and body
      }

      const result = await emailTool.validate(args)
      expect(result.success).toBe(false)
      expect(result.errors?.length).toBeGreaterThan(0)
    })

    it('should accept optional fields', async () => {
      const args = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body content',
        cc: ['cc@example.com'],
        attachments: [{
          filename: 'test.txt',
          content: 'base64content',
          type: 'text/plain'
        }]
      }

      const result = await emailTool.validate(args)
      expect(result.success).toBe(true)
    })
  })

  describe('Execution', () => {
    it('should execute successfully with valid args', async () => {
      const args = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body content'
      }

      const config = {
        userId: 'test-user',
        permissions: [],
        rateLimit: { requests: 100, period: '1h', strategy: 'sliding' }
      }

      const result = await emailTool.execute(args, config)
      expect(result.success).toBe(true)
      expect(result.data?.messageId).toBeDefined()
      expect(result.data?.to).toBe(args.to)
      expect(result.metadata?.executionTime).toBeGreaterThan(0)
    })

    it('should handle rate limiting', async () => {
      const args = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body content'
      }

      const config = {
        userId: 'rate-limited-user',
        permissions: [],
        rateLimit: { requests: 0, period: '1h', strategy: 'sliding' }
      }

      const result = await emailTool.execute(args, config)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit exceeded')
    })
  })

  describe('Caching', () => {
    it('should use cache for identical requests', async () => {
      const args = {
        to: 'cache-test@example.com',
        subject: 'Cache Test',
        body: 'Cache test content'
      }

      const config = {
        userId: 'cache-user',
        permissions: [],
        rateLimit: { requests: 100, period: '1h', strategy: 'sliding' }
      }

      // First execution
      const result1 = await emailTool.execute(args, config)
      expect(result1.success).toBe(true)

      // Second execution (should use cache)
      const result2 = await emailTool.execute(args, config)
      expect(result2.success).toBe(true)
      expect(result2.metadata?.cacheHit).toBe(true)
    })
  })

  describe('Hooks', () => {
    it('should execute before and after hooks', async () => {
      const args = {
        to: 'hook-test@example.com',
        subject: 'Hook Test',
        body: 'Hook test content'
      }

      const config = {
        userId: 'hook-user',
        permissions: [],
        rateLimit: { requests: 100, period: '1h', strategy: 'sliding' }
      }

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation((..._args: unknown[]) => undefined)

      await emailTool.execute(args, config)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📧 Preparing to send email')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Email sent successfully')
      )

      consoleSpy.mockRestore()
    })
  })
})
