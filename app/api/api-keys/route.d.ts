import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string | undefined;
    code: string;
}> | NextResponse<{
    success: boolean;
    data: any;
}>>;
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string | undefined;
    code: string;
}> | NextResponse<{
    success: boolean;
    data: {
        id: string;
        keyPrefix: string;
        name: string;
        quotaRequestsPerMinute: number;
        quotaRequestsPerDay: number;
        createdAt: string;
        usage: {
            requestsToday: number;
            requestsThisHour: number;
            successRate: number;
        };
    };
}>>;
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string | undefined;
    code: string;
}> | NextResponse<{
    success: boolean;
    message: string;
}>>;
//# sourceMappingURL=route.d.ts.map