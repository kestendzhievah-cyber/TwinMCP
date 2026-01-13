"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const auth_service_1 = require("@/lib/services/auth.service");
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma = new client_1.PrismaClient();
const authService = new auth_service_1.AuthService(prisma, new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379'));
async function GET(request) {
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
        // Récupérer les clés API de l'utilisateur
        const apiKeys = await authService.listUserApiKeys(authResult.apiKeyData.userId);
        // Ajouter les statistiques d'utilisation (simulation pour l'instant)
        const keysWithUsage = apiKeys.map(key => ({
            ...key,
            usage: {
                requestsToday: Math.floor(Math.random() * 500),
                requestsThisHour: Math.floor(Math.random() * 50),
                successRate: 95 + Math.random() * 5
            }
        }));
        return server_1.NextResponse.json({
            success: true,
            data: keysWithUsage
        });
    }
    catch (error) {
        console.error('Error fetching API keys:', error);
        return server_1.NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
async function POST(request) {
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
        const { name } = body;
        if (!name || typeof name !== 'string') {
            return server_1.NextResponse.json({
                error: 'Name parameter is required and must be a string',
                code: 'INVALID_NAME'
            }, { status: 400 });
        }
        // Vérifier la limite de clés (max 10 par utilisateur)
        const existingKeys = await authService.listUserApiKeys(authResult.apiKeyData.userId);
        if (existingKeys.length >= 10) {
            return server_1.NextResponse.json({
                error: 'Maximum API keys limit reached (10 keys per user)',
                code: 'KEY_LIMIT_EXCEEDED'
            }, { status: 400 });
        }
        // Générer une nouvelle clé API
        const newApiKey = await authService.generateApiKey(authResult.apiKeyData.userId, name);
        return server_1.NextResponse.json({
            success: true,
            data: {
                id: newApiKey.apiKey,
                keyPrefix: newApiKey.prefix,
                name,
                quotaRequestsPerMinute: 100,
                quotaRequestsPerDay: 10000,
                createdAt: new Date().toISOString(),
                usage: {
                    requestsToday: 0,
                    requestsThisHour: 0,
                    successRate: 100
                }
            }
        });
    }
    catch (error) {
        console.error('Error creating API key:', error);
        return server_1.NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
async function DELETE(request) {
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
        // Parser l'URL pour obtenir l'ID de la clé à révoquer
        const url = new URL(request.url);
        const keyId = url.pathname.split('/').pop();
        if (!keyId) {
            return server_1.NextResponse.json({
                error: 'Key ID is required',
                code: 'MISSING_KEY_ID'
            }, { status: 400 });
        }
        // Révoquer la clé API
        const success = await authService.revokeApiKey(keyId, authResult.apiKeyData.userId);
        if (!success) {
            return server_1.NextResponse.json({
                error: 'API key not found or already revoked',
                code: 'KEY_NOT_FOUND'
            }, { status: 404 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'API key revoked successfully'
        });
    }
    catch (error) {
        console.error('Error revoking API key:', error);
        return server_1.NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map