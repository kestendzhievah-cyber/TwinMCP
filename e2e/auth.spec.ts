import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('Auth page loads', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.locator('body')).toBeVisible()
  })

  test('POST /api/auth/login rejects invalid credentials', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'invalid@test.com', password: 'wrong' },
    })
    // Should return 401 or 400 for bad credentials
    expect([400, 401, 403]).toContain(res.status())
  })

  test('POST /api/auth/signup with missing fields returns 400', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: {},
    })
    expect([400, 422]).toContain(res.status())
  })

  test('GET /api/auth/me without token returns 401', async ({ request }) => {
    const res = await request.get('/api/auth/me')
    expect([401, 403]).toContain(res.status())
  })
})
