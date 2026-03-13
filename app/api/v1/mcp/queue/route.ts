import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/mcp/middleware/auth';
import { getQueue } from '@/lib/mcp/utils/queue';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/v1/mcp/queue - Liste des jobs de l'utilisateur
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authContext = await authService.authenticate(request);
    if (!authContext.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as any;
    const rawLimit = parseInt(url.searchParams.get('limit') || '20');
    const rawOffset = parseInt(url.searchParams.get('offset') || '0');
    // Cap pagination to prevent abuse
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const queue = getQueue();

    // SECURITY: Always scope jobs to the authenticated user.
    // The previous code allowed any user to list ALL jobs by status — IDOR violation.
    let jobs = await queue.getJobsByUser(authContext.userId);
    if (status) {
      jobs = jobs.filter((j: any) => j.status === status);
    }

    // Pagination
    const paginatedJobs = jobs.slice(offset, offset + limit);

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
        maxRetries: job.maxRetries,
        // Ne pas inclure result/error pour des raisons de sécurité
      })),
      totalCount: jobs.length,
      limit,
      offset,
      hasMore: offset + limit < jobs.length,
      apiVersion: 'v1',
      metadata: {
        executionTime: Date.now() - startTime,
        queueStats: queue.getStats(),
      },
    });
  } catch (error) {
    return handleApiError(error, 'McpQueue');
  }
}
