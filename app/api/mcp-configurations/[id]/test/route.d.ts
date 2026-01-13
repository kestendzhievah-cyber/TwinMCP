import { NextRequest, NextResponse } from 'next/server';
export declare function POST(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}): Promise<NextResponse<{
    success: boolean;
    message: string;
    timestamp: string;
    details: {
        configId: string;
        name: string;
        status: string;
    };
}> | NextResponse<{
    success: boolean;
    message: string;
    error: string;
    timestamp: string;
}>>;
//# sourceMappingURL=route.d.ts.map