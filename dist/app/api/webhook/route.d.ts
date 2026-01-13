import { NextRequest, NextResponse } from 'next/server';
export declare function POST(req: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    received: boolean;
}>>;
//# sourceMappingURL=route.d.ts.map