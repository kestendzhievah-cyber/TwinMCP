import { MCPTool, ValidationResult, ExecutionResult } from '../../core/types';
import { z } from 'zod';
import { VectorSearchService } from '../../../services/vector-search.service';
export declare class QueryDocsTool implements MCPTool {
    id: string;
    name: string;
    version: string;
    category: "development";
    description: string;
    author: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig: string[];
    inputSchema: z.ZodObject<{
        library_id: z.ZodString;
        query: z.ZodString;
        version: z.ZodOptional<z.ZodString>;
        max_results: z.ZodDefault<z.ZodNumber>;
        include_code: z.ZodDefault<z.ZodBoolean>;
        context_limit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        library_id: string;
        max_results: number;
        include_code: boolean;
        context_limit: number;
        version?: string | undefined;
    }, {
        query: string;
        library_id: string;
        version?: string | undefined;
        max_results?: number | undefined;
        include_code?: boolean | undefined;
        context_limit?: number | undefined;
    }>;
    capabilities: {
        async: boolean;
        batch: boolean;
        streaming: boolean;
        webhook: boolean;
    };
    rateLimit: {
        requests: number;
        period: string;
        strategy: "sliding";
    };
    cache: {
        enabled: boolean;
        ttl: number;
        key: (args: any) => string;
        strategy: "redis";
    };
    private vectorSearchService;
    constructor(vectorSearchService: VectorSearchService);
    validate(args: any): Promise<ValidationResult>;
    execute(args: any, config: any): Promise<ExecutionResult>;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error, args: any): Promise<void>;
}
//# sourceMappingURL=query-docs.tool.d.ts.map