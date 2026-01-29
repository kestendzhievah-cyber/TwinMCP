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
    userId?: string;
    apiKeyId?: string;
    tier?: string;
    quotaDaily?: number;
    quotaMonthly?: number;
    usedDaily?: number;
    usedMonthly?: number;
    error?: string;
    errorCode?: string;
}
export interface UsageTrackingData {
    apiKeyId: string;
    userId: string;
    toolName: string;
    libraryId?: string;
    query?: string;
    tokensReturned?: number;
    responseTimeMs: number;
    success: boolean;
    errorMessage?: string;
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