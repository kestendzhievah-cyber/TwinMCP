import { z } from 'zod';
export interface ValidationResult {
    success: boolean;
    errors?: Array<{
        path: string;
        message: string;
    }>;
    data?: any;
}
export interface ExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        executionTime: number;
        cacheHit: boolean;
        apiCallsCount: number;
        cost?: number;
    };
}
export interface RateLimitConfig {
    requests: number;
    period: string;
    strategy: 'fixed' | 'sliding' | 'token-bucket';
}
export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    key: (args: any) => string;
    strategy: 'memory' | 'redis' | 'hybrid';
}
export interface ToolCapabilities {
    async: boolean;
    batch: boolean;
    streaming: boolean;
    webhook: boolean;
}
export interface MCPTool {
    id: string;
    name: string;
    version: string;
    category: 'communication' | 'productivity' | 'development' | 'data';
    description: string;
    author?: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig?: string[];
    inputSchema: z.ZodSchema;
    validate: (args: any) => Promise<ValidationResult>;
    execute: (args: any, config: any) => Promise<ExecutionResult>;
    beforeExecute?: (args: any) => Promise<any>;
    afterExecute?: (result: ExecutionResult) => Promise<ExecutionResult>;
    onError?: (error: Error, args: any) => Promise<void>;
    capabilities: ToolCapabilities;
    rateLimit?: RateLimitConfig;
    cache?: CacheConfig;
    usageStats?: {
        totalCalls: number;
        successRate: number;
        avgExecutionTime: number;
        lastUsed?: Date;
    };
}
export interface Plugin {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    tools: MCPTool[];
    dependencies?: string[];
    config?: Record<string, any>;
}
export interface ToolFilters {
    category?: string;
    tags?: string[];
    capabilities?: Partial<ToolCapabilities>;
    hasRateLimit?: boolean;
    hasCache?: boolean;
}
export interface ToolMetrics {
    toolId: string;
    userId: string;
    timestamp: Date;
    executionTime: number;
    cacheHit: boolean;
    success: boolean;
    errorType?: string;
    apiCallsCount: number;
    estimatedCost?: number;
}
export interface QueueJob {
    id: string;
    toolId: string;
    args: any;
    userId: string;
    priority: 'low' | 'normal' | 'high';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: ExecutionResult;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    retries: number;
    maxRetries: number;
}
//# sourceMappingURL=types.d.ts.map