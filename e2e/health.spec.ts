import { test, expect } from '@playwright/test'

test.describe('Health & Landing', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  test('Landing page loads and contains TwinMCP branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/TwinMCP|Twin/i)
  })
})
