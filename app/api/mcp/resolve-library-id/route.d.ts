import { NextRequest, NextResponse } from 'next/server';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string | undefined;
    code: string;
}> | NextResponse<{
    success: boolean;
    data: import("../../../../lib/services/library-resolution.service").ResolveLibraryIdOutput;
}>>;
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
    code: string;
}>>;
//# sourceMappingURL=route.d.ts.map