import { NextRequest, NextResponse } from 'next/server';
export declare function POST(req: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    subscriptionId: string;
    clientSecret: any;
}>>;
export declare function GET(req: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    status: any;
    current_period_end: any;
}>>;
//# sourceMappingURL=route.d.ts.map