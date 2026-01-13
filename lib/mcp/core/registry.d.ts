import { MCPTool, Plugin, ToolFilters } from './types';
export declare class MCPRegistry {
    private tools;
    private plugins;
    private toolsByCategory;
    register(tool: MCPTool): void;
    unregister(toolId: string): void;
    get(toolId: string): MCPTool | undefined;
    getAll(): MCPTool[];
    getByCategory(category: string): MCPTool[];
    search(query: string, filters?: ToolFilters): MCPTool[];
    exists(toolId: string): boolean;
    getStats(): {
        totalTools: number;
        toolsByCategory: Record<string, number>;
        toolsWithRateLimit: number;
        toolsWithCache: number;
        toolsWithWebhooks: number;
        asyncTools: number;
        streamingTools: number;
    };
    private validateTool;
    loadPlugin(plugin: Plugin): void;
    unloadPlugin(pluginId: string): void;
    getPlugins(): Plugin[];
    exportConfig(): {
        tools: {
            id: string;
            name: string;
            version: string;
            category: "communication" | "productivity" | "development" | "data";
            description: string;
            tags: string[];
            capabilities: import("./types").ToolCapabilities;
            rateLimit: import("./types").RateLimitConfig | undefined;
            cache: import("./types").CacheConfig | undefined;
        }[];
        plugins: {
            id: string;
            name: string;
            version: string;
            tools: string[];
        }[];
        stats: {
            totalTools: number;
            toolsByCategory: Record<string, number>;
            toolsWithRateLimit: number;
            toolsWithCache: number;
            toolsWithWebhooks: number;
            asyncTools: number;
            streamingTools: number;
        };
    };
    clear(): void;
}
export declare const registry: MCPRegistry;
//# sourceMappingURL=registry.d.ts.map