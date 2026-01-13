"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const tools_1 = require("@/lib/mcp/tools");
const queue_1 = require("@/lib/mcp/utils/queue");
const metrics_1 = require("@/lib/mcp/utils/metrics");
// GET /api/v1/mcp/health - Health check
async function GET(request) {
    const startTime = Date.now();
    try {
        // Vérifications de santé
        const registryStats = tools_1.registry.getStats();
        const queue = (0, queue_1.getQueue)();
        const queueStats = queue.getStats();
        const systemMetrics = await (0, metrics_1.getMetrics)().getSystemStats();
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
        };
        const statusCode = health.status === 'healthy' ? 200 : 503;
        return server_1.NextResponse.json(health, { status: statusCode });
    }
    catch (error) {
        console.error('Health check error:', error);
        return server_1.NextResponse.json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            apiVersion: 'v1'
        }, { status: 503 });
    }
}
//# sourceMappingURL=route.js.map