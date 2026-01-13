"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const tools_1 = require("@/lib/mcp/tools");
const auth_1 = require("@/lib/mcp/middleware/auth");
const validator_1 = require("@/lib/mcp/core/validator");
const rate_limit_1 = require("@/lib/mcp/middleware/rate-limit");
const queue_1 = require("@/lib/mcp/utils/queue");
const metrics_1 = require("@/lib/mcp/utils/metrics");
// POST /api/v1/mcp/execute - Exécuter un outil
async function POST(request) {
    const startTime = Date.now();
    try {
        // Authentification
        const authContext = await auth_1.authService.authenticate(request);
        if (!authContext.isAuthenticated) {
            return server_1.NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        // Parse du body
        const body = await request.json();
        const { toolId, args, async: isAsync = false } = body;
        // Validation des paramètres de base
        if (!toolId) {
            return server_1.NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
        }
        // Obtenir l'outil
        const tool = tools_1.registry.get(toolId);
        if (!tool) {
            return server_1.NextResponse.json({ error: `Tool '${toolId}' not found` }, { status: 404 });
        }
        // Autorisation
        const authorized = await auth_1.authService.authorize(authContext, toolId, 'execute');
        if (!authorized) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        // Validation des arguments
        const validation = await validator_1.validator.validate(toolId, args);
        if (!validation.success) {
            return server_1.NextResponse.json({
                error: 'Validation failed',
                details: validation.errors
            }, { status: 400 });
        }
        // Validation de sécurité
        const securityValidation = await validator_1.validator.securityValidate(args);
        if (!securityValidation.success) {
            return server_1.NextResponse.json({
                error: 'Security validation failed',
                details: securityValidation.errors
            }, { status: 400 });
        }
        // Rate limiting
        const rateLimitCheck = await rate_limit_1.rateLimiter.checkUserLimit(authContext.userId, toolId);
        if (!rateLimitCheck) {
            return server_1.NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }
        // Exécution synchrone vs asynchrone
        if (isAsync && tool.capabilities.async) {
            // Mode asynchrone - ajouter à la queue
            const queue = (0, queue_1.getQueue)();
            const jobId = await queue.enqueue({
                toolId,
                args: validation.data,
                userId: authContext.userId,
                priority: 'normal',
                maxRetries: 3
            });
            (0, metrics_1.getMetrics)().track({
                toolId,
                userId: authContext.userId,
                timestamp: new Date(),
                executionTime: Date.now() - startTime,
                cacheHit: false,
                success: true,
                apiCallsCount: 1,
                estimatedCost: 0
            });
            return server_1.NextResponse.json({
                jobId,
                status: 'queued',
                message: 'Tool execution queued for async processing',
                apiVersion: 'v1',
                metadata: {
                    executionTime: Date.now() - startTime,
                    queueTime: 0
                }
            });
        }
        else {
            // Mode synchrone
            const result = await tool.execute(validation.data, {
                userId: authContext.userId,
                permissions: authContext.permissions,
                rateLimit: authContext.rateLimit
            });
            // Tracker les métriques
            (0, metrics_1.getMetrics)().track({
                toolId,
                userId: authContext.userId,
                timestamp: new Date(),
                executionTime: Date.now() - startTime,
                cacheHit: result.metadata?.cacheHit || false,
                success: result.success,
                errorType: result.success ? undefined : 'ExecutionError',
                apiCallsCount: result.metadata?.apiCallsCount || 1,
                estimatedCost: result.metadata?.cost || 0
            });
            if (result.success) {
                return server_1.NextResponse.json({
                    result: result.data,
                    success: true,
                    apiVersion: 'v1',
                    metadata: {
                        executionTime: result.metadata?.executionTime || (Date.now() - startTime),
                        cacheHit: result.metadata?.cacheHit || false,
                        cost: result.metadata?.cost || 0,
                        authenticated: authContext.isAuthenticated,
                        authMethod: authContext.authMethod
                    }
                });
            }
            else {
                return server_1.NextResponse.json({
                    error: result.error,
                    success: false,
                    apiVersion: 'v1',
                    metadata: {
                        executionTime: result.metadata?.executionTime || (Date.now() - startTime),
                        authenticated: authContext.isAuthenticated,
                        authMethod: authContext.authMethod
                    }
                }, { status: 500 });
            }
        }
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        (0, metrics_1.getMetrics)().track({
            toolId: 'unknown',
            userId: 'anonymous',
            timestamp: new Date(),
            executionTime,
            cacheHit: false,
            success: false,
            errorType: error.name || 'APIError',
            apiCallsCount: 1,
            estimatedCost: 0
        });
        console.error('Tool execution error:', error);
        return server_1.NextResponse.json({
            error: error.message || 'Tool execution failed',
            apiVersion: 'v1'
        }, { status: error.statusCode || 500 });
    }
}
//# sourceMappingURL=route.js.map