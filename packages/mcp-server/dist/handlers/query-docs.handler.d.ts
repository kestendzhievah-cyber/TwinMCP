import { ToolHandler, QueryDocsParams, QueryDocsResult, MCPContext } from '../types/mcp';
import { TwinMCPClient } from '../client/twinmcp-client';
export declare class QueryDocsHandler implements ToolHandler<QueryDocsParams, QueryDocsResult> {
    private client;
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            libraryId: {
                type: string;
                description: string;
                minLength: number;
                maxLength: number;
            };
            query: {
                type: string;
                description: string;
                minLength: number;
                maxLength: number;
            };
            version: {
                type: string;
                description: string;
                pattern: string;
            };
            contentType: {
                type: string;
                description: string;
                enum: string[];
            };
            maxResults: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
                default: number;
            };
            maxTokens: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
                default: number;
            };
        };
        required: string[];
    };
    constructor(client: TwinMCPClient);
    handler(params: QueryDocsParams, context: MCPContext): Promise<QueryDocsResult>;
}
//# sourceMappingURL=query-docs.handler.d.ts.map