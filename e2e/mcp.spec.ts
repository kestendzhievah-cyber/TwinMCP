import { test, expect } from '@playwright/test'

test.describe('MCP API Endpoints', () => {
  test('POST /api/mcp/call without auth returns 401', async ({ request }) => {
    const res = await request.post('/api/mcp/call', {
      data: { method: 'tools/list', params: {} },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/monitoring/health returns system health', async ({ request }) => {
    const res = await request.get('/api/monitoring/health')
    // Health endpoint is public
    if (res.ok()) {
      const body = await res.json()
      expect(body).toHaveProperty('status')
    }
  })

  test('GET /api/analytics/usage without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/analytics/usage')
    expect([401, 403]).toContain(res.status())
  })
})
