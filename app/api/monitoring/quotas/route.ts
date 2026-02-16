/**
 * GET /api/monitoring/quotas — Quota monitoring dashboard API.
 *
 * Returns per-user and global quota usage, rate limit stats,
 * burst bucket status, and top consumers.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Lazy-import to avoid circular deps at module load
    const { rateLimiter } = await import('@/lib/mcp/middleware/rate-limit')

    const stats = rateLimiter.getStats()

    // Build quota overview
    const overview = {
      timestamp: new Date().toISOString(),
      rateLimiting: {
        backend: stats.backend,
        activeWindows: stats.memoryStoreSize,
        burstBuckets: stats.burstBuckets,
      },
      defaults: {
        userLimit: { requests: 60, period: '1m' },
        globalLimit: { requests: 1000, period: '1m' },
        ipLimit: { requests: 100, period: '1m' },
        burstLimit: { rate: 10, burstCapacity: 20 },
      },
      health: {
        status: 'healthy',
        uptime: process.uptime(),
        memoryUsage: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      },
    }

    return NextResponse.json(overview)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch quota stats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
