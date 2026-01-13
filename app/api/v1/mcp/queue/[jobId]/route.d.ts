import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest, { params }: {
    params: {
        jobId: string;
    };
}): Promise<NextResponse<{
    error: any;
}>>;
export declare function DELETE(request: NextRequest, { params }: {
    params: {
        jobId: string;
    };
}): Promise<NextResponse<{
    jobId: string;
    status: string;
    message: string;
    apiVersion: string;
    metadata: {
        executionTime: number;
    };
}> | NextResponse<{
    error: any;
}>>;
//# sourceMappingURL=route.d.ts.map