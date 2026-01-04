import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/mcp/middleware/auth'
import { getQueue } from '@/lib/mcp/utils/queue'

// GET /api/v1/mcp/queue/[jobId] - Status d'un job
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const startTime = Date.now()

  try {
    const authContext = await authService.authenticate(request)
    if (!authContext.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { jobId } = params
    const queue = getQueue()
    const job = await queue.getStatus(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur peut accéder à ce job
    if (job.userId !== authContext.userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      jobId: job.id,
      toolId: job.toolId,
      status: job.status,
      priority: job.priority,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      retries: job.retries,
      maxRetries: job.maxRetries,
      result: job.result,
      error: job.error,
      apiVersion: 'v1',
      metadata: {
        executionTime: Date.now() - startTime,
        isOwner: job.userId === authContext.userId
      }
    })

  } catch (error: any) {
    console.error('Queue job status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get job status' },
      { status: error.statusCode || 500 }
    )
  }
}

// DELETE /api/v1/mcp/queue/[jobId] - Annuler un job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const startTime = Date.now()

  try {
    const authContext = await authService.authenticate(request)
    if (!authContext.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { jobId } = params
    const queue = getQueue()
    const cancelled = await queue.cancelJob(jobId, authContext.userId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job not found or cannot be cancelled' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      jobId,
      status: 'cancelled',
      message: 'Job cancelled successfully',
      apiVersion: 'v1',
      metadata: {
        executionTime: Date.now() - startTime
      }
    })

  } catch (error: any) {
    console.error('Queue job cancel error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel job' },
      { status: error.statusCode || 500 }
    )
  }
}
