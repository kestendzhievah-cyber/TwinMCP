import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/mcp/middleware/auth'
import { getQueue } from '@/lib/mcp/utils/queue'

// GET /api/v1/mcp/queue - Liste des jobs de l'utilisateur
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const authContext = await authService.authenticate(request)
    if (!authContext.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') as any
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const queue = getQueue()

    let jobs
    if (status) {
      jobs = await queue.getJobsByStatus(status)
    } else {
      jobs = await queue.getJobsByUser(authContext.userId)
    }

    // Pagination
    const paginatedJobs = jobs.slice(offset, offset + limit)

    return NextResponse.json({
      jobs: paginatedJobs.map(job => ({
        id: job.id,
        toolId: job.toolId,
        status: job.status,
        priority: job.priority,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        retries: job.retries,
        maxRetries: job.maxRetries
        // Ne pas inclure result/error pour des raisons de sécurité
      })),
      totalCount: jobs.length,
      limit,
      offset,
      hasMore: offset + limit < jobs.length,
      apiVersion: 'v1',
      metadata: {
        executionTime: Date.now() - startTime,
        queueStats: queue.getStats()
      }
    })

  } catch (error: any) {
    console.error('Queue list error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list queue jobs' },
      { status: error.statusCode || 500 }
    )
  }
}
