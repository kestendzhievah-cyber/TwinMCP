import { z } from 'zod';
import { MCPTool, ValidationResult, ExecutionResult } from '../../core';
export declare class FirebaseTool implements MCPTool {
    id: string;
    name: string;
    version: string;
    category: 'data';
    description: string;
    author: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig: string[];
    inputSchema: z.ZodDiscriminatedUnion<"operation", [z.ZodObject<{
        collection: z.ZodString;
        documentId: z.ZodOptional<z.ZodString>;
        where: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodEnum<["==", "!=", "<", "<=", ">", ">=", "in", "array-contains"]>;
            value: z.ZodAny;
        }, "strip", z.ZodTypeAny, {
            field: string;
            operator: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
            value?: any;
        }, {
            field: string;
            operator: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
            value?: any;
        }>, "many">>;
        orderBy: z.ZodOptional<z.ZodObject<{
            field: z.ZodString;
            direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            direction: "asc" | "desc";
        }, {
            field: string;
            direction?: "asc" | "desc" | undefined;
        }>>;
        limit: z.ZodDefault<z.ZodNumber>;
        select: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        operation: z.ZodLiteral<"read">;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        collection: string;
        operation: "read";
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        } | undefined;
        documentId?: string | undefined;
        where?: {
            field: string;
            operator: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
            value?: any;
        }[] | undefined;
        select?: string[] | undefined;
    }, {
        collection: string;
        operation: "read";
        limit?: number | undefined;
        orderBy?: {
            field: string;
            direction?: "asc" | "desc" | undefined;
        } | undefined;
        documentId?: string | undefined;
        where?: {
            field: string;
            operator: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
            value?: any;
        }[] | undefined;
        select?: string[] | undefined;
    }>, z.ZodObject<{
        collection: z.ZodString;
        documentId: z.ZodOptional<z.ZodString>;
        data: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
        merge: z.ZodDefault<z.ZodBoolean>;
        timestamp: z.ZodDefault<z.ZodBoolean>;
        operation: z.ZodLiteral<"write">;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, any>;
        timestamp: boolean;
        collection: string;
        merge: boolean;
        operation: "write";
        documentId?: string | undefined;
    }, {
        data: Record<string, any>;
        collection: string;
        operation: "write";
        timestamp?: boolean | undefined;
        documentId?: string | undefined;
        merge?: boolean | undefined;
    }>]>;
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
        strategy: "memory";
    };
    validate(args: any): Promise<ValidationResult>;
    execute(args: any, config: any): Promise<ExecutionResult>;
    private readFirebase;
    private writeFirebase;
    private generateMockData;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error): Promise<void>;
}
//# sourceMappingURL=firebase.d.ts.map