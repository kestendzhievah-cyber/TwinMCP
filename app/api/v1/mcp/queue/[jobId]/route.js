"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const auth_1 = require("@/lib/mcp/middleware/auth");
const queue_1 = require("@/lib/mcp/utils/queue");
// GET /api/v1/mcp/queue/[jobId] - Status d'un job
async function GET(request, { params }) {
    const startTime = Date.now();
    try {
        const authContext = await auth_1.authService.authenticate(request);
        if (!authContext.isAuthenticated) {
            return server_1.NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        const { jobId } = params;
        const queue = (0, queue_1.getQueue)();
        const job = await queue.getStatus(jobId);
        if (!job) {
            return server_1.NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }
        // Vérifier que l'utilisateur peut accéder à ce job
        if (job.userId !== authContext.userId) {
            return server_1.NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        return server_1.NextResponse.json({
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
        });
    }
    catch (error) {
        console.error('Queue job status error:', error);
        return server_1.NextResponse.json({ error: error.message || 'Failed to get job status' }, { status: error.statusCode || 500 });
    }
}
// DELETE /api/v1/mcp/queue/[jobId] - Annuler un job
async function DELETE(request, { params }) {
    const startTime = Date.now();
    try {
        const authContext = await auth_1.authService.authenticate(request);
        if (!authContext.isAuthenticated) {
            return server_1.NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        const { jobId } = params;
        const queue = (0, queue_1.getQueue)();
        const cancelled = await queue.cancelJob(jobId, authContext.userId);
        if (!cancelled) {
            return server_1.NextResponse.json({ error: 'Job not found or cannot be cancelled' }, { status: 404 });
        }
        return server_1.NextResponse.json({
            jobId,
            status: 'cancelled',
            message: 'Job cancelled successfully',
            apiVersion: 'v1',
            metadata: {
                executionTime: Date.now() - startTime
            }
        });
    }
    catch (error) {
        console.error('Queue job cancel error:', error);
        return server_1.NextResponse.json({ error: error.message || 'Failed to cancel job' }, { status: error.statusCode || 500 });
    }
}
//# sourceMappingURL=route.js.map