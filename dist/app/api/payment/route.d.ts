import { NextRequest, NextResponse } from 'next/server';
export declare function POST(req: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    clientSecret: string | null;
    paymentIntentId: string;
}>>;
//# sourceMappingURL=route.d.ts.map