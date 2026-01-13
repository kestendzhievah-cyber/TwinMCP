import { NextRequest, NextResponse } from 'next/server';
interface AuthenticatedRequest extends NextRequest {
    user?: {
        id: string;
    };
}
export declare function GET(req: AuthenticatedRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    message: string;
}>>;
export declare function POST(req: AuthenticatedRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
export {};
//# sourceMappingURL=route.d.ts.map