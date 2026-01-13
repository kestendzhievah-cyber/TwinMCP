import { NextRequest, NextResponse } from 'next/server';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    message: string;
    user: {
        uid: string;
        email: string | null;
        displayName: string | null;
        emailVerified: boolean;
    };
}>>;
//# sourceMappingURL=route.d.ts.map