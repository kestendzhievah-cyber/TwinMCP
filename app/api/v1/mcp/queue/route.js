"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/mcp/middleware/auth");
const queue_1 = require("@/lib/mcp/utils/queue");
// GET /api/v1/mcp/queue - Liste des jobs de l'utilisateur
async function GET(request) {
    const startTime = Date.now();
    try {
        const authContext = await auth_1.authService.authenticate(request);
        if (!authContext.isAuthenticated) {
            return server_1.NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const queue = (0, queue_1.getQueue)();
        let jobs;
        if (status) {
            jobs = await queue.getJobsByStatus(status);
        }
        else {
            jobs = await queue.getJobsByUser(authContext.userId);
        }
        // Pagination
        const paginatedJobs = jobs.slice(offset, offset + limit);
        return server_1.NextResponse.json({
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
        });
    }
    catch (error) {
        console.error('Queue list error:', error);
        return server_1.NextResponse.json({ error: error.message || 'Failed to list queue jobs' }, { status: error.statusCode || 500 });
    }
}
//# sourceMappingURL=route.js.map