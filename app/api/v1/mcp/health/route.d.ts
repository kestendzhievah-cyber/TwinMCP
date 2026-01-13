import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    status: string;
    timestamp: string;
    uptime: number;
    version: string;
    apiVersion: string;
    services: {
        registry: {
            status: string;
            toolsCount: number;
            categories: string[];
        };
        queue: {
            status: string;
            pendingJobs: number;
            processingJobs: number;
            workers: number;
        };
        metrics: {
            status: string;
            totalExecutions: number;
            successRate: number;
        };
    };
    performance: {
        avgResponseTime: number;
        cacheHitRate: number;
        errorRate: number;
    };
    metadata: {
        executionTime: number;
    };
}> | NextResponse<{
    status: string;
    timestamp: string;
    error: any;
    apiVersion: string;
}>>;
//# sourceMappingURL=route.d.ts.map