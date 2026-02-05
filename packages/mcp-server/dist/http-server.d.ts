import express from 'express';
import { TwinMCPConfig, ToolHandler } from './types/mcp';
export interface HttpServerConfig {
    port: number;
    host: string;
    corsOrigins?: string[];
    apiKeyValidation: (apiKey: string) => Promise<ApiKeyValidationResult>;
    usageTracking: (data: UsageTrackingData) => Promise<void>;
}
export interface ApiKeyValidationResult {
    valid: boolean;
    userId?: string | undefined;
    apiKeyId?: string | undefined;
    tier?: string | undefined;
    quotaDaily?: number | undefined;
    quotaMonthly?: number | undefined;
    usedDaily?: number | undefined;
    usedMonthly?: number | undefined;
    error?: string | undefined;
    errorCode?: string | undefined;
}
export interface UsageTrackingData {
    apiKeyId: string;
    userId: string;
    toolName: string;
    libraryId?: string | undefined;
    query?: string | undefined;
    tokensReturned?: number | undefined;
    responseTimeMs: number;
    success: boolean;
    errorMessage?: string | undefined;
}
export declare class TwinMCPHttpServer {
    private app;
    private server;
    private client;
    private logger;
    private handlers;
    private config;
    private httpServer?;
    private transports;
    constructor(config: HttpServerConfig, mcpConfig?: TwinMCPConfig);
    private setupMiddleware;
    private setupHandlers;
    private setupRoutes;
    private authMiddleware;
    private extractApiKey;
    private setupErrorHandling;
    private handleError;
    private generateRequestId;
    private estimateTokens;
    start(): Promise<void>;
    stop(): Promise<void>;
    addHandler(handler: ToolHandler): void;
    getApp(): express.Application;
}
//# sourceMappingURL=http-server.d.ts.map