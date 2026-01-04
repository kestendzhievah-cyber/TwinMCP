import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { initializeMCP } from '../../lib/mcp/init'

// Mock Next.js request for testing
interface MockNextRequest {
  url: string
  headers: Map<string, string>
  body?: string
  method?: string
}

const createMockRequest = (url: string, options: any = {}): MockNextRequest => {
  return {
    url,
    headers: new Map(Object.entries(options.headers || {})),
    body: options.body,
    method: options.method || 'GET'
  }
}

describe('MCP API Integration', () => {
  beforeAll(async () => {
    await initializeMCP()
  })

  afterAll(async () => {
    // Cleanup if needed
  })

  describe('Tools API', () => {
    it('should list all available tools', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/tools')
      const response = await fetch(request.url)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tools).toBeDefined()
      expect(Array.isArray(data.tools)).toBe(true)
      expect(data.totalCount).toBeGreaterThan(0)
      expect(data.apiVersion).toBe('v1')
    })

    it('should execute email tool', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'email',
          args: {
            to: 'test@example.com',
            subject: 'Test Email',
            body: 'This is a test email'
          }
        })
      })

      const response = await fetch(request.url, {
        method: 'POST',
        headers: Object.fromEntries(request.headers),
        body: request.body
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result).toBeDefined()
      expect(data.result.messageId).toBeDefined()
      expect(data.apiVersion).toBe('v1')
    })

    it('should validate email arguments', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'email',
          args: {
            to: 'invalid-email',
            subject: 'Test Email'
            // missing body
          }
        })
      })

      const response = await fetch(request.url, {
        method: 'POST',
        headers: Object.fromEntries(request.headers),
        body: request.body
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Validation failed')
    })

    it('should enforce rate limiting', async () => {
      const requests = []

      // Make multiple rapid requests
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'mcp-default-key-12345'
          },
          body: JSON.stringify({
            toolId: 'email',
            args: {
              to: 'ratelimit@example.com',
              subject: `Rate Limit Test ${i}`,
              body: 'Rate limit test email'
            }
          })
        })

        requests.push(fetch(request.url, {
          method: 'POST',
          headers: Object.fromEntries(request.headers),
          body: request.body
        }))
      }

      const responses = await Promise.all(requests)
      const rateLimited = responses.some(r => r.status === 429)

      // At least one should be rate limited (depending on implementation)
      expect(rateLimited).toBe(true)
    })
  })

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/health')
      const response = await fetch(request.url)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.apiVersion).toBe('v1')
      expect(data.services.registry.status).toBe('healthy')
      expect(data.services.queue.status).toBe('healthy')
    })
  })

  describe('Authentication', () => {
    it('should require authentication for protected endpoints', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toolId: 'email',
          args: {
            to: 'test@example.com',
            subject: 'Test',
            body: 'Test'
          }
        })
      })

      const response = await fetch(request.url, {
        method: 'POST',
        headers: Object.fromEntries(request.headers),
        body: request.body
      })

      expect(response.status).toBe(401)
    })

    it('should accept valid API key', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'email',
          args: {
            to: 'test@example.com',
            subject: 'Test',
            body: 'Test'
          }
        })
      })

      const response = await fetch(request.url, {
        method: 'POST',
        headers: Object.fromEntries(request.headers),
        body: request.body
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown tool', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'unknown-tool',
          args: {}
        })
      })

      const response = await fetch(request.url, {
        method: 'POST',
        headers: Object.fromEntries(request.headers),
        body: request.body
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    it('should handle missing required arguments', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'email',
          args: {
            to: 'test@example.com'
            // missing subject and body
          }
        })
      })

      const response = await fetch(request.url, {
        method: 'POST',
        headers: Object.fromEntries(request.headers),
        body: request.body
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Validation failed')
    })
  })

  describe('Caching', () => {
    it('should cache identical requests', async () => {
      const args = {
        to: 'cache-test@example.com',
        subject: 'Cache Test',
        body: 'Cache test content'
      }

      // First request
      const request1 = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'email',
          args
        })
      })

      const response1 = await fetch(request1.url, {
        method: 'POST',
        headers: Object.fromEntries(request1.headers),
        body: request1.body
      })

      expect(response1.status).toBe(200)
      const data1 = await response1.json()
      expect(data1.metadata.cacheHit).toBe(false)

      // Second request (should be cached)
      const request2 = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mcp-default-key-12345'
        },
        body: JSON.stringify({
          toolId: 'email',
          args
        })
      })

      const response2 = await fetch(request2.url, {
        method: 'POST',
        headers: Object.fromEntries(request2.headers),
        body: request2.body
      })

      expect(response2.status).toBe(200)
      const data2 = await response2.json()
      expect(data2.metadata.cacheHit).toBe(true)
    })
  })
})
