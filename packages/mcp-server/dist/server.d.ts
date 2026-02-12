import { TwinMCPConfig, ToolHandler } from './types/mcp';
import { MCPLogger } from './utils/logger';
import { TwinMCPClient } from './client/twinmcp-client';
export interface TwinMCPServerOptions {
    config?: TwinMCPConfig;
    logger?: MCPLogger;
}
export declare class TwinMCPServer {
    private server;
    private client;
    private logger;
    private handlers;
    constructor(options?: TwinMCPServerOptions);
    private setupHandlers;
    private setupErrorHandling;
    run(): Promise<void>;
    close(): Promise<void>;
    private generateRequestId;
    addHandler(handler: ToolHandler): void;
    getClient(): TwinMCPClient;
}
//# sourceMappingURL=server.d.ts.map