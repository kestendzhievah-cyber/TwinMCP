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
        const { query, context, limit, include_aliases } = body;
        // Validation basique
        if (!query || typeof query !== 'string') {
            return server_1.NextResponse.json({
                error: 'Query parameter is required and must be a string',
                code: 'INVALID_QUERY'
            }, { status: 400 });
        }
        // Exécuter la résolution
        const result = await mcp_tools_1.libraryResolutionService.resolveLibrary({
            query,
            context,
            limit: limit || 5,
            include_aliases: include_aliases !== false
        });
        // Logger l'usage
        await authService.logUsage(authResult.apiKeyData.id, 'resolve-library-id', undefined, query, undefined, Date.now() - startTime);
        return server_1.NextResponse.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error in resolve-library-id:', error);
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