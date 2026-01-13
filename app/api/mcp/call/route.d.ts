import { NextRequest, NextResponse } from 'next/server';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    content: {
        type: string;
        text: Promise<string>;
    }[];
}>>;
//# sourceMappingURL=route.d.ts.map