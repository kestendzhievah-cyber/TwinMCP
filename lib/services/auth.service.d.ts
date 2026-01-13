import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
export interface ApiKeyData {
    id: string;
    userId: string;
    keyPrefix: string;
    quotaRequestsPerMinute: number;
    quotaRequestsPerDay: number;
}
export interface AuthResult {
    success: boolean;
    apiKeyData?: ApiKeyData;
    error?: string;
}
export declare class AuthService {
    private db;
    private redis;
    constructor(db: PrismaClient, redis: Redis);
    validateApiKey(apiKey: string): Promise<AuthResult>;
    private checkQuotas;
    generateApiKey(userId: string, name?: string): Promise<{
        apiKey: string;
        prefix: string;
    }>;
    revokeApiKey(apiKeyId: string, userId: string): Promise<boolean>;
    listUserApiKeys(userId: string): Promise<any>;
    private generateRandomString;
    logUsage(apiKeyId: string, toolName: string, libraryId?: string, query?: string, tokensReturned?: number, responseTimeMs?: number): Promise<void>;
}
//# sourceMappingURL=auth.service.d.ts.map