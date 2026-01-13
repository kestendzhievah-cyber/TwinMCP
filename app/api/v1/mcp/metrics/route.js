"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/mcp/middleware/auth");
const metrics_1 = require("@/lib/mcp/utils/metrics");
// GET /api/v1/mcp/metrics - Métriques système et outils
async function GET(request) {
    const startTime = Date.now();
    try {
        // Authentification (seulement pour les utilisateurs authentifiés)
        const authContext = await auth_1.authService.authenticate(request);
        if (!authContext.isAuthenticated) {
            return server_1.NextResponse.json({ error: 'Authentication required for metrics access' }, { status: 401 });
        }
        // Autorisation (seulement pour les admins)
        const isAdmin = authContext.permissions.some(p => p.resource === 'global' && p.actions.includes('admin'));
        if (!isAdmin) {
            return server_1.NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
        }
        const url = new URL(request.url);
        const period = url.searchParams.get('period') || 'day';
        const toolId = url.searchParams.get('toolId');
        let metrics;
        if (toolId) {
            // Métriques pour un outil spécifique
            const toolStats = await (0, metrics_1.getMetrics)().getToolStats(toolId);
            const systemStats = await (0, metrics_1.getMetrics)().getSystemStats();
            metrics = {
                toolId,
                toolStats,
                systemStats,
                period,
                apiVersion: 'v1',
                metadata: {
                    executionTime: Date.now() - startTime,
                    generatedAt: new Date().toISOString()
                }
            };
        }
        else {
            // Métriques système globales
            const systemStats = await (0, metrics_1.getMetrics)().getSystemStats();
            const topTools = await (0, metrics_1.getMetrics)().getTopTools(10);
            const errorAnalysis = await (0, metrics_1.getMetrics)().getErrorAnalysis();
            const report = await (0, metrics_1.getMetrics)().generateReport(period);
            metrics = {
                systemStats,
                topTools,
                errorAnalysis,
                report,
                apiVersion: 'v1',
                metadata: {
                    executionTime: Date.now() - startTime,
                    generatedAt: new Date().toISOString(),
                    period
                }
            };
        }
        return server_1.NextResponse.json(metrics);
    }
    catch (error) {
        console.error('Metrics error:', error);
        return server_1.NextResponse.json({
            error: error.message || 'Failed to retrieve metrics',
            apiVersion: 'v1'
        }, { status: error.statusCode || 500 });
    }
}
//# sourceMappingURL=route.js.map