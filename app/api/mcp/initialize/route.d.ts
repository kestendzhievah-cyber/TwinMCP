import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    success: boolean;
    message: string;
    data: {
        client: {
            name: string;
            activeModules: never[];
            apiKeysConfigured: number;
            settings: {};
        };
        timestamp: string;
        name: string;
        version: string;
        capabilities: {
            tools: {};
        };
    };
}> | NextResponse<{
    success: boolean;
    error: string;
}>>;
export declare function POST(request: NextRequest): Promise<NextResponse<{
    success: boolean;
    message: string;
    data: {
        client: {
            name: string;
            activeModules: never[];
            apiKeysConfigured: number;
            settings: {};
            timestamp: string;
        };
        availableTools: string[];
        name: string;
        version: string;
        capabilities: {
            tools: {};
        };
    };
}> | NextResponse<{
    success: boolean;
    error: string;
}>>;
//# sourceMappingURL=route.d.ts.map