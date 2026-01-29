import { ToolHandler, MCPContext, ResolveLibraryParams, ResolveLibraryResult } from '../types/mcp';
import { TwinMCPClient } from '../client/twinmcp-client';
export declare class ResolveLibraryHandler implements ToolHandler<ResolveLibraryParams, ResolveLibraryResult> {
    private client;
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
                minLength: number;
                maxLength: number;
            };
            context: {
                type: string;
                properties: {
                    language: {
                        type: string;
                        description: string;
                    };
                    framework: {
                        type: string;
                        description: string;
                    };
                    ecosystem: {
                        type: string;
                        description: string;
                    };
                };
                description: string;
            };
            limit: {
                type: string;
                minimum: number;
                maximum: number;
                default: number;
                description: string;
            };
            include_aliases: {
                type: string;
                default: boolean;
                description: string;
            };
        };
        required: string[];
    };
    constructor(client: TwinMCPClient);
    handler(params: ResolveLibraryParams, context: MCPContext): Promise<ResolveLibraryResult>;
}
//# sourceMappingURL=resolve-library.handler.d.ts.map