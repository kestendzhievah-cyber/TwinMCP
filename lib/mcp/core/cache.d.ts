import { CacheConfig } from './types';
export declare class MCPCache {
    private memory;
    private redis?;
    private config;
    constructor(config: CacheConfig);
    initialize(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, customTtl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    invalidate(pattern: string): Promise<void>;
    clear(): Promise<void>;
    getStats(): {
        memorySize: number;
        strategy: "memory" | "redis" | "hybrid";
        redisConnected: boolean;
    };
    private isExpired;
    private cleanup;
    close(): Promise<void>;
}
export declare function getCache(): MCPCache;
export declare function initializeCache(): Promise<void>;
export declare function closeCache(): Promise<void>;
//# sourceMappingURL=cache.d.ts.map