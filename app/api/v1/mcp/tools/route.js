"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const tools_1 = require("@/lib/mcp/tools");
const auth_1 = require("@/lib/mcp/middleware/auth");
const rate_limit_1 = require("@/lib/mcp/middleware/rate-limit");
const metrics_1 = require("@/lib/mcp/utils/metrics");
// GET /api/v1/mcp/tools - Liste des outils disponibles
async function GET(request) {
    const startTime = Date.now();
    try {
        // Authentification
        const authContext = await auth_1.authService.authenticate(request);
        // Rate limiting
        const rateLimitCheck = await rate_limit_1.rateLimiter.checkUserLimit(authContext.userId, 'tools_list');
        if (!rateLimitCheck) {
            return server_1.NextResponse.json({ error: 'Rate limit exceeded for tools list' }, { status: 429 });
        }
        // Obtenir les outils (filtrés selon les permissions)
        const tools = tools_1.registry.getAll().filter(tool => {
            return auth_1.authService.authorize(authContext, tool.id, 'read');
        });
        // Tracker les métriques
        (0, metrics_1.getMetrics)().track({
            toolId: 'tools_list',
            userId: authContext.userId,
            timestamp: new Date(),
            executionTime: Date.now() - startTime,
            cacheHit: false,
            success: true,
            apiCallsCount: 1,
            estimatedCost: 0.0001
        });
        return server_1.NextResponse.json({
            tools: tools.map(tool => ({
                id: tool.id,
                name: tool.name,
                version: tool.version,
                category: tool.category,
                description: tool.description,
                author: tool.author,
                tags: tool.tags,
                capabilities: tool.capabilities,
                rateLimit: tool.rateLimit,
                cache: tool.cache,
                inputSchema: tool.inputSchema instanceof Object ? {
                    type: 'object',
                    properties: {},
                    required: []
                } : tool.inputSchema // Simplifié pour l'API
            })),
            totalCount: tools.length,
            apiVersion: 'v1',
            metadata: {
                executionTime: Date.now() - startTime,
                authenticated: authContext.isAuthenticated,
                authMethod: authContext.authMethod
            }
        });
    }
    catch (error) {
        (0, metrics_1.getMetrics)().track({
            toolId: 'tools_list',
            userId: 'anonymous',
            timestamp: new Date(),
            executionTime: Date.now() - startTime,
            cacheHit: false,
            success: false,
            errorType: error.name || 'ToolsListError',
            apiCallsCount: 1,
            estimatedCost: 0
        });
        console.error('Tools list error:', error);
        return server_1.NextResponse.json({ error: error.message || 'Failed to list tools' }, { status: error.statusCode || 500 });
    }
}
//# sourceMappingURL=route.js.map