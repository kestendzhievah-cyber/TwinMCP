import { NextRequest, NextResponse } from 'next/server'
import { registry } from '@/lib/mcp/tools'
import { authService } from '@/lib/mcp/middleware/auth'
import { getQueue } from '@/lib/mcp/utils/queue'
import { getMetrics } from '@/lib/mcp/utils/metrics'

// GET /api/v1/mcp/health - Health check
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Vérifications de santé
    const registryStats = registry.getStats()
    const queue = getQueue()
    const queueStats = queue.getStats()
    const systemMetrics = await getMetrics().getSystemStats()

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      apiVersion: 'v1',
      services: {
        registry: {
          status: 'healthy',
          toolsCount: registryStats.totalTools,
          categories: Object.keys(registryStats.toolsByCategory)
        },
        queue: {
          status: 'healthy',
          pendingJobs: queueStats.pending,
          processingJobs: queueStats.processing,
          workers: queueStats.workersTotal
        },
        metrics: {
          status: 'healthy',
          totalExecutions: systemMetrics.totalExecutions,
          successRate: 100 - systemMetrics.errorRate
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

    const statusCode = health.status === 'healthy' ? 200 : 503

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
