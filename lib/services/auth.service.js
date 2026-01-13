"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class AuthService {
    db;
    redis;
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }
    async validateApiKey(apiKey) {
        try {
            if (!apiKey || !apiKey.startsWith('twinmcp_')) {
                return {
                    success: false,
                    error: 'Invalid API key format'
                };
            }
            // Extraire le préfixe pour la recherche
            const keyPrefix = apiKey.slice(0, 20); // twinmcp_live_ ou twinmcp_test_
            // Rechercher la clé API dans la base de données
            const apiKeyRecord = await this.db.apiKey.findFirst({
                where: {
                    keyPrefix: keyPrefix,
                    revokedAt: null
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            clientId: true
                        }
                    }
                }
            });
            if (!apiKeyRecord) {
                return {
                    success: false,
                    error: 'API key not found or revoked'
                };
            }
            // Vérifier le hash
            const isValid = await bcryptjs_1.default.compare(apiKey, apiKeyRecord.keyHash);
            if (!isValid) {
                return {
                    success: false,
                    error: 'Invalid API key'
                };
            }
            // Vérifier les quotas
            const quotaCheck = await this.checkQuotas(apiKeyRecord.id, apiKeyRecord.quotaRequestsPerMinute, apiKeyRecord.quotaRequestsPerDay);
            if (!quotaCheck.allowed) {
                return {
                    success: false,
                    error: quotaCheck.reason
                };
            }
            // Mettre à jour le dernier usage
            await this.db.apiKey.update({
                where: { id: apiKeyRecord.id },
                data: { lastUsedAt: new Date() }
            });
            return {
                success: true,
                apiKeyData: {
                    id: apiKeyRecord.id,
                    userId: apiKeyRecord.userId,
                    keyPrefix: apiKeyRecord.keyPrefix,
                    quotaRequestsPerMinute: apiKeyRecord.quotaRequestsPerMinute,
                    quotaRequestsPerDay: apiKeyRecord.quotaRequestsPerDay
                }
            };
        }
        catch (error) {
            console.error('Error validating API key:', error);
            return {
                success: false,
                error: 'Authentication failed'
            };
        }
    }
    async checkQuotas(apiKeyId, perMinuteLimit, perDayLimit) {
        const now = new Date();
        const currentMinute = Math.floor(now.getTime() / 60000);
        const currentDay = Math.floor(now.getTime() / 86400000);
        // Vérifier quota par minute
        const minuteKey = `rate_limit:${apiKeyId}:${currentMinute}`;
        const minuteCount = await this.redis.incr(minuteKey);
        if (minuteCount === 1) {
            await this.redis.expire(minuteKey, 60);
        }
        if (minuteCount > perMinuteLimit) {
            return {
                allowed: false,
                reason: 'Rate limit exceeded: too many requests per minute'
            };
        }
        // Vérifier quota par jour
        const dayKey = `rate_limit:${apiKeyKey}:${currentDay}`;
        const dayCount = await this.redis.incr(dayKey);
        if (dayCount === 1) {
            await this.redis.expire(dayKey, 86400);
        }
        if (dayCount > perDayLimit) {
            return {
                allowed: false,
                reason: 'Daily quota exceeded'
            };
        }
        return { allowed: true };
    }
    async generateApiKey(userId, name) {
        const prefix = 'twinmcp_live_';
        const randomPart = this.generateRandomString(32);
        const apiKey = prefix + randomPart;
        // Hasher la clé
        const saltRounds = 12;
        const keyHash = await bcryptjs_1.default.hash(apiKey, saltRounds);
        // Sauvegarder dans la base de données
        await this.db.apiKey.create({
            data: {
                userId,
                keyHash,
                keyPrefix: prefix + randomPart.slice(0, 12),
                name: name || `API Key ${new Date().toISOString()}`,
                quotaRequestsPerMinute: 100,
                quotaRequestsPerDay: 10000
            }
        });
        return {
            apiKey,
            prefix: prefix + randomPart.slice(0, 12)
        };
    }
    async revokeApiKey(apiKeyId, userId) {
        try {
            const result = await this.db.apiKey.updateMany({
                where: {
                    id: apiKeyId,
                    userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });
            return result.count > 0;
        }
        catch (error) {
            console.error('Error revoking API key:', error);
            return false;
        }
    }
    async listUserApiKeys(userId) {
        return await this.db.apiKey.findMany({
            where: {
                userId,
                revokedAt: null
            },
            select: {
                id: true,
                keyPrefix: true,
                name: true,
                quotaRequestsPerMinute: true,
                quotaRequestsPerDay: true,
                lastUsedAt: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    async logUsage(apiKeyId, toolName, libraryId, query, tokensReturned, responseTimeMs) {
        try {
            await this.db.usageLog.create({
                data: {
                    apiKeyId,
                    toolName,
                    libraryId,
                    query,
                    tokensReturned,
                    responseTimeMs
                }
            });
        }
        catch (error) {
            console.error('Error logging usage:', error);
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map