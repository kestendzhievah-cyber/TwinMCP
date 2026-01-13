import { LibraryResolutionService } from './services/library-resolution.service';
import { VectorSearchService } from './services/vector-search.service';
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}
declare const libraryResolutionService: LibraryResolutionService;
declare const vectorSearchService: VectorSearchService;
export declare const mcpTools: MCPTool[];
export declare const serverInfo: {
    name: string;
    version: string;
    capabilities: {
        tools: {};
    };
};
export declare const executeTool: (toolName: string, args: any) => Promise<string>;
export declare const validateToolArgs: (tool: MCPTool, args: any) => string[];
export { libraryResolutionService, vectorSearchService };
//# sourceMappingURL=mcp-tools.d.ts.map