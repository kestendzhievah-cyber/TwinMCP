import { test, expect } from '@playwright/test'

test.describe('API Keys Endpoints', () => {
  test('GET /api/api-keys without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/api-keys')
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/auth/validate-key rejects invalid key', async ({ request }) => {
    const res = await request.post('/api/auth/validate-key', {
      data: { apiKey: 'invalid-key-12345' },
    })
    expect([400, 401, 403]).toContain(res.status())
  })
})
