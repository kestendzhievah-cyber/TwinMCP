import { NextRequest, NextResponse } from 'next/server';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    jobId: string;
    status: string;
    message: string;
    apiVersion: string;
    metadata: {
        executionTime: number;
        queueTime: number;
    };
}> | NextResponse<{
    result: any;
    success: boolean;
    apiVersion: string;
    metadata: {
        executionTime: number;
        cacheHit: boolean;
        cost: number;
        authenticated: true;
        authMethod: "jwt" | "api_key" | "none";
    };
}> | NextResponse<{
    error: any;
    apiVersion: string;
}>>;
//# sourceMappingURL=route.d.ts.map