"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const mcp_tools_1 = require("@/lib/mcp-tools");
const auth_service_1 = require("@/lib/services/auth.service");
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma = new client_1.PrismaClient();
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
const authService = new auth_service_1.AuthService(prisma, redis);
async function POST(request) {
    const startTime = Date.now();
    try {
        // Authentification via API Key
        const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
        if (!apiKey) {
            return server_1.NextResponse.json({
                error: 'API key required',
                code: 'MISSING_API_KEY'
            }, { status: 401 });
        }
        const authResult = await authService.validateApiKey(apiKey);
        if (!authResult.success) {
            return server_1.NextResponse.json({
                error: authResult.error,
                code: 'INVALID_API_KEY'
            }, { status: 401 });
        }
        // Parser le corps de la requête
        const body = await request.json();
        const { library_id, query, version, max_results, include_code, context_limit } = body;
        // Validation basique
        if (!library_id || typeof library_id !== 'string') {
            return server_1.NextResponse.json({
                error: 'library_id parameter is required and must be a string',
                code: 'INVALID_LIBRARY_ID'
            }, { status: 400 });
        }
        if (!query || typeof query !== 'string') {
            return server_1.NextResponse.json({
                error: 'query parameter is required and must be a string',
                code: 'INVALID_QUERY'
            }, { status: 400 });
        }
        // Exécuter la recherche de documentation
        const result = await mcp_tools_1.vectorSearchService.searchDocuments({
            library_id,
            query,
            version,
            max_results: max_results || 5,
            include_code: include_code !== false,
            context_limit: context_limit || 4000
        });
        // Logger l'usage
        await authService.logUsage(authResult.apiKeyData.id, 'query-docs', library_id, query, result.totalTokens, Date.now() - startTime);
        return server_1.NextResponse.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error in query-docs:', error);
        return server_1.NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
async function GET(request) {
    return server_1.NextResponse.json({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
    }, { status: 405 });
}
//# sourceMappingURL=route.js.map