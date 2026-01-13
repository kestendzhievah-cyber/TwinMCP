import { NextRequest, NextResponse } from 'next/server';
export declare function POST(req: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    url: string | null;
}>>;
//# sourceMappingURL=route.d.ts.map