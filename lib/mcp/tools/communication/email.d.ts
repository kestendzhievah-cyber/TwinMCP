import { z } from 'zod';
import { MCPTool, ValidationResult, ExecutionResult } from '../../core';
export declare class EmailTool implements MCPTool {
    id: string;
    name: string;
    version: string;
    category: 'communication';
    description: string;
    author: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig: string[];
    inputSchema: z.ZodObject<{
        to: z.ZodString;
        subject: z.ZodString;
        body: z.ZodString;
        from: z.ZodOptional<z.ZodString>;
        cc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        bcc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            filename: z.ZodString;
            content: z.ZodString;
            type: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            filename: string;
            content: string;
        }, {
            type: string;
            filename: string;
            content: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        to: string;
        subject: string;
        body: string;
        from?: string | undefined;
        cc?: string[] | undefined;
        bcc?: string[] | undefined;
        attachments?: {
            type: string;
            filename: string;
            content: string;
        }[] | undefined;
    }, {
        to: string;
        subject: string;
        body: string;
        from?: string | undefined;
        cc?: string[] | undefined;
        bcc?: string[] | undefined;
        attachments?: {
            type: string;
            filename: string;
            content: string;
        }[] | undefined;
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
        strategy: "memory";
    };
    validate(args: any): Promise<ValidationResult>;
    execute(args: any, config: any): Promise<ExecutionResult>;
    private sendEmail;
}
//# sourceMappingURL=email.d.ts.map