import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    tools: {
        id: string;
        name: string;
        version: string;
        category: "communication" | "productivity" | "development" | "data";
        description: string;
        author: string | undefined;
        tags: string[];
        capabilities: import("../../../../../lib/mcp/core").ToolCapabilities;
        rateLimit: import("../../../../../lib/mcp/core").RateLimitConfig | undefined;
        cache: import("../../../../../lib/mcp/core").CacheConfig | undefined;
        inputSchema: {
            type: string;
            properties: {};
            required: never[];
        };
    }[];
    totalCount: number;
    apiVersion: string;
    metadata: {
        executionTime: number;
        authenticated: boolean;
        authMethod: "jwt" | "api_key" | "none";
    };
}> | NextResponse<{
    error: any;
}>>;
//# sourceMappingURL=route.d.ts.map