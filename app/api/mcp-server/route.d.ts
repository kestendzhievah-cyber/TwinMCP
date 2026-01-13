import { NextRequest, NextResponse } from 'next/server';
export declare function GET(): Promise<NextResponse<{
    status: string;
    serverInfo: {
        name: string;
        version: string;
        tools: string[];
        capabilities: {
            tools: {};
        };
    };
}> | NextResponse<{
    error: string;
}>>;
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    result: {
        content: {
            type: string;
            text: Promise<string>;
        }[];
    };
}> | NextResponse<{
    tools: {
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, any>;
            required: string[];
        };
    }[];
}> | NextResponse<{
    capabilities: {
        tools: {};
    };
    serverInfo: {
        name: string;
        version: string;
    };
}>>;
//# sourceMappingURL=route.d.ts.map