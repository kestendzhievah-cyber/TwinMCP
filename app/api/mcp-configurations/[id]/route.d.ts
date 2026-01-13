import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}): Promise<NextResponse<{
    id: string;
    name: string;
    description: string;
    configData: string;
    status: string;
    createdAt: string;
    product: {
        name: string;
    };
    user: {
        email: string;
    };
}> | NextResponse<{
    error: string;
}>>;
export declare function PUT(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}): Promise<NextResponse<{
    id: string;
    name: any;
    description: any;
    configData: any;
    status: any;
    createdAt: string;
    product: {
        name: string;
    };
}> | NextResponse<{
    error: string;
}>>;
export declare function DELETE(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}): Promise<NextResponse<{
    message: string;
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=route.d.ts.map