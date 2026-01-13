import { NextRequest, NextResponse } from 'next/server';
export declare function GET(request: NextRequest): Promise<NextResponse<{
    jobs: {
        id: string;
        toolId: string;
        status: "pending" | "processing" | "completed" | "failed";
        priority: "low" | "normal" | "high";
        createdAt: Date;
        startedAt: Date | undefined;
        completedAt: Date | undefined;
        retries: number;
        maxRetries: number;
    }[];
    totalCount: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    apiVersion: string;
    metadata: {
        executionTime: number;
        queueStats: {
            total: number;
            pending: number;
            processing: number;
            completed: number;
            failed: number;
            workersBusy: number;
            workersTotal: number;
            avgProcessingTime: number;
        };
    };
}> | NextResponse<{
    error: any;
}>>;
//# sourceMappingURL=route.d.ts.map