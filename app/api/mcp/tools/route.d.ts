import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    tools: {
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, any>;
            required: string[];
        };
    }[];
    serverInfo: {
        name: string;
        version: string;
    };
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=route.d.ts.map