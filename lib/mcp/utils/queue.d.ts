import { QueueJob } from '../core/types';
export declare class MCPQueue {
    private jobs;
    private workers;
    private maxWorkers;
    private jobTimeout;
    private persistenceCallback?;
    private webhookCallback?;
    constructor(options?: {
        maxWorkers?: number;
        jobTimeout?: number;
        persistenceCallback?: (job: QueueJob) => Promise<void>;
        webhookCallback?: (job: QueueJob) => Promise<void>;
    });
    private initializeWorkers;
    enqueue(job: Omit<QueueJob, 'id' | 'status' | 'createdAt' | 'retries'>): Promise<string>;
    getStatus(jobId: string): Promise<QueueJob | null>;
    getJobsByUser(userId: string): Promise<QueueJob[]>;
    getJobsByStatus(status: QueueJob['status']): Promise<QueueJob[]>;
    cancelJob(jobId: string, userId: string): Promise<boolean>;
    private processJob;
    private notifyWorkers;
    private getNextJob;
    getStats(): {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        workersBusy: number;
        workersTotal: number;
        avgProcessingTime: number;
    };
    clear(): Promise<void>;
    close(): Promise<void>;
}
export declare function getQueue(): MCPQueue;
export declare function initializeQueue(): Promise<void>;
export declare function closeQueue(): Promise<void>;
//# sourceMappingURL=queue.d.ts.map