import { TwinMCPConfig, ResolveLibraryParams, ResolveLibraryResult, QueryDocsParams, QueryDocsResult } from '../types/mcp';
import { MCPLogger } from '../utils/logger';
export interface TwinMCPClientOptions extends TwinMCPConfig {
    timeout?: number;
    retries?: number;
    logger?: MCPLogger;
}
export declare class TwinMCPClient {
    private config;
    private logger;
    constructor(options?: TwinMCPClientOptions);
    resolveLibrary(params: ResolveLibraryParams): Promise<ResolveLibraryResult>;
    queryDocs(params: QueryDocsParams): Promise<QueryDocsResult>;
    private makeRequest;
    private fetchWithTimeout;
    private generateRequestId;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=twinmcp-client.d.ts.map