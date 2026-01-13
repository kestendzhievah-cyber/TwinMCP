import { NextRequest, NextResponse } from 'next/server';
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
    message: string;
    newCount: number;
    remainingSlots: string;
}>>;
//# sourceMappingURL=route.d.ts.map