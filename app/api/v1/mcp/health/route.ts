import { NextRequest, NextResponse } from 'next/server'
import { registry } from '@/lib/mcp/tools'
import { authService } from '@/lib/mcp/middleware/auth'
import { getQueue } from '@/lib/mcp/utils/queue'
import { getMetrics } from '@/lib/mcp/utils/metrics'
import { rateLimiter } from '@/lib/mcp/middleware/rate-limit'
import { ensureMCPInitialized, isMCPInitialized } from '@/lib/mcp/ensure-init'

type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy'

async function checkDatabase(): Promise<{ status: ServiceStatus; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch (error: any) {
    return { status: 'unhealthy', latencyMs: Date.now() - start, error: error.message }
  }
}

async function checkRedis(): Promise<{ status: ServiceStatus; latencyMs: number; error?: string }> {
  const start = Date.now()
  if (process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL) {
    return { status: 'degraded', latencyMs: 0, error: 'Redis disabled or not configured' }
  }
  try {
    const { redis } = await import('@/lib/redis')
    await redis.ping()
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch (error: any) {
    return { status: 'unhealthy', latencyMs: Date.now() - start, error: error.message }
  }
}

function deriveOverallStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.some(s => s === 'unhealthy')) return 'unhealthy'
  if (statuses.some(s => s === 'degraded')) return 'degraded'
  return 'healthy'
}

// GET /api/v1/mcp/health - Health check
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Ensure MCP system is initialized (lazy init)
    await ensureMCPInitialized()

    // Deep health checks (run in parallel)
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ])

    // Vérifications de santé internes
    const registryStats = registry.getStats()
    const queue = getQueue()
    const queueStats = queue.getStats()
    const systemMetrics = await getMetrics().getSystemStats()
    const rateLimitStats = rateLimiter.getStats()

    const registryStatus: ServiceStatus = registryStats.totalTools > 0 ? 'healthy' : 'degraded'
    const queueStatus: ServiceStatus = 'healthy'
    const metricsStatus: ServiceStatus = 'healthy'

    const overallStatus = deriveOverallStatus([
      dbHealth.status,
      redisHealth.status,
      registryStatus,
      queueStatus,
      metricsStatus
    ])

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      apiVersion: 'v1',
      services: {
        database: {
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
          ...(dbHealth.error && { error: dbHealth.error })
        },
        redis: {
          status: redisHealth.status,
          latencyMs: redisHealth.latencyMs,
          ...(redisHealth.error && { error: redisHealth.error })
        },
        registry: {
          status: registryStatus,
          toolsCount: registryStats.totalTools,
          categories: Object.keys(registryStats.toolsByCategory)
        },
        queue: {
          status: queueStatus,
          pendingJobs: queueStats.pending,
          processingJobs: queueStats.processing,
          workers: queueStats.workersTotal
        },
        metrics: {
          status: metricsStatus,
          totalExecutions: systemMetrics.totalExecutions,
          successRate: 100 - systemMetrics.errorRate
        },
        rateLimiter: {
          backend: rateLimitStats.backend,
          activeKeys: rateLimitStats.memoryStoreSize
        }
      },
      performance: {
        avgResponseTime: systemMetrics.avgResponseTime,
        cacheHitRate: systemMetrics.cacheHitRate,
        errorRate: systemMetrics.errorRate
      },
      metadata: {
        executionTime: Date.now() - startTime
      }
    }

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200

    return NextResponse.json(health, { status: statusCode })

  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      apiVersion: 'v1'
    }, { status: 503 })
  }
}
