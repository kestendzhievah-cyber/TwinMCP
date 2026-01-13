import { NextRequest, NextResponse } from 'next/server';
interface SendMessageResponse {
    reply: string;
    conversationId: string;
    messageId?: string;
}
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<SendMessageResponse>>;
export {};
//# sourceMappingURL=route.d.ts.map