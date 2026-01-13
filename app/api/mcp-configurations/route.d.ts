import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    id: string;
    name: string;
    description: string;
    configData: string;
    status: string;
    createdAt: string;
    product: {
        name: string;
    };
}[]> | NextResponse<{
    error: string;
}>>;
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    id: string;
    name: any;
    description: any;
    configData: any;
    status: string;
    createdAt: string;
    product: {
        name: string;
    };
}>>;
//# sourceMappingURL=route.d.ts.map