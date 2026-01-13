import { ToolMetrics } from '../core/types';
interface MetricsConfig {
    retentionDays: number;
    enablePersistence: boolean;
    enableAnalytics: boolean;
}
interface ToolStats {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    errorCount: number;
    lastUsed?: Date;
}
interface SystemStats {
    totalExecutions: number;
    activeUsers: number;
    toolsUsed: number;
    avgResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
}
export declare class MetricsCollector {
    private metrics;
    private config;
    private toolStats;
    private systemStats;
    constructor(config?: MetricsConfig);
    track(metric: ToolMetrics): Promise<void>;
    private updateToolStats;
    private updateSystemStats;
    getToolStats(toolId: string): Promise<ToolStats | null>;
    getSystemStats(): Promise<SystemStats>;
    getTopTools(limit?: number): Promise<Array<{
        toolId: string;
        stats: ToolStats;
    }>>;
    getErrorAnalysis(): Promise<{
        byTool: Array<{
            toolId: string;
            errors: number;
            errorRate: number;
        }>;
        byType: Array<{
            errorType: string;
            count: number;
        }>;
        recent: ToolMetrics[];
    }>;
    generateReport(period: 'day' | 'week' | 'month'): Promise<{
        period: string;
        systemStats: SystemStats;
        topTools: Array<{
            toolId: string;
            stats: ToolStats;
        }>;
        errorAnalysis: any;
        recommendations: string[];
    }>;
    private cleanup;
    private sendToAnalytics;
    private persistMetric;
    private alertOnError;
}
export declare function getMetrics(): MetricsCollector;
export declare function initializeMetrics(): Promise<void>;
export {};
//# sourceMappingURL=metrics.d.ts.map