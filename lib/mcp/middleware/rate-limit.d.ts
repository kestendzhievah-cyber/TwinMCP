import { RateLimitConfig } from './auth-types';
interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    current: number;
}
export declare class RateLimiter {
    private stores;
    private memoryStore;
    constructor();
    checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
    checkUserLimit(userId: string, toolId: string, config?: Partial<RateLimitConfig>): Promise<boolean>;
    checkGlobalLimit(toolId: string, maxRequests?: number): Promise<boolean>;
    checkIPLimit(ip: string, maxRequests?: number): Promise<boolean>;
    checkMultipleLimits(userId: string, toolId: string, ip: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    getStats(): {
        activeStores: number;
        memoryStoreSize: number;
    };
    resetLimit(key: string): Promise<void>;
    private getStore;
    private parseTimePeriod;
}
export declare const rateLimiter: RateLimiter;
export {};
//# sourceMappingURL=rate-limit.d.ts.map