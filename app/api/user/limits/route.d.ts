import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<import("@/lib/user-limits").UserLimitsResponse>>;
//# sourceMappingURL=route.d.ts.map