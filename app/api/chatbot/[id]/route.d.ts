import { NextResponse } from 'next/server';
export declare function GET(request: Request, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    id: string;
    name: any;
    description: any;
    model: any;
    systemPrompt: any;
    temperature: any;
    maxTokens: any;
    isActive: any;
    conversationsCount: any;
    createdAt: any;
    updatedAt: any;
}>>;
export declare function PUT(request: Request, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    id: string;
    name: any;
    description: any;
    model: any;
    systemPrompt: any;
    temperature: any;
    maxTokens: any;
    isActive: any;
    conversationsCount: any;
    createdAt: any;
    updatedAt: any;
}>>;
//# sourceMappingURL=route.d.ts.map