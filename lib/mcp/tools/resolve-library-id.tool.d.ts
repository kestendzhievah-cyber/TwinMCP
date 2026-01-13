import { MCPTool, ValidationResult, ExecutionResult } from '../../core/types';
import { z } from 'zod';
import { LibraryResolutionService } from '../../../services/library-resolution.service';
export declare class ResolveLibraryIdTool implements MCPTool {
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
        query: z.ZodString;
        context: z.ZodOptional<z.ZodObject<{
            language: z.ZodOptional<z.ZodString>;
            framework: z.ZodOptional<z.ZodString>;
            ecosystem: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            language?: string | undefined;
            framework?: string | undefined;
            ecosystem?: string | undefined;
        }, {
            language?: string | undefined;
            framework?: string | undefined;
            ecosystem?: string | undefined;
        }>>;
        limit: z.ZodDefault<z.ZodNumber>;
        include_aliases: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        query: string;
        include_aliases: boolean;
        context?: {
            language?: string | undefined;
            framework?: string | undefined;
            ecosystem?: string | undefined;
        } | undefined;
    }, {
        query: string;
        limit?: number | undefined;
        context?: {
            language?: string | undefined;
            framework?: string | undefined;
            ecosystem?: string | undefined;
        } | undefined;
        include_aliases?: boolean | undefined;
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
    private resolutionService;
    constructor(resolutionService: LibraryResolutionService);
    validate(args: any): Promise<ValidationResult>;
    execute(args: any, config: any): Promise<ExecutionResult>;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error, args: any): Promise<void>;
}
//# sourceMappingURL=resolve-library-id.tool.d.ts.map