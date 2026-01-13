import { NextRequest, NextResponse } from 'next/server';
interface CreateChatbotResponse {
    success: boolean;
    chatbotId: string;
    publicUrl: string;
    qrCode: string;
    newCount: number;
}
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<CreateChatbotResponse>>;
export {};
//# sourceMappingURL=route.d.ts.map