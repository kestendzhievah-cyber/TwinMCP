import { z } from 'zod';
import { MCPTool, ValidationResult, ExecutionResult } from '../../core';
export declare class NotionTool implements MCPTool {
    id: string;
    name: string;
    version: string;
    category: 'productivity';
    description: string;
    author: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig: string[];
    inputSchema: z.ZodObject<{
        title: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        parentId: z.ZodOptional<z.ZodString>;
        databaseId: z.ZodOptional<z.ZodString>;
        properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        children: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            children: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            content?: string | undefined;
            children?: any;
        }, {
            type: string;
            content?: string | undefined;
            children?: any;
        }>, "many">>;
        icon: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["emoji", "external", "file"]>;
            emoji: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "emoji" | "external" | "file";
            url?: string | undefined;
            emoji?: string | undefined;
        }, {
            type: "emoji" | "external" | "file";
            url?: string | undefined;
            emoji?: string | undefined;
        }>>;
        cover: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["external", "file"]>;
            url: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "external" | "file";
            url?: string | undefined;
        }, {
            type: "external" | "file";
            url?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        content?: string | undefined;
        parentId?: string | undefined;
        databaseId?: string | undefined;
        properties?: Record<string, any> | undefined;
        children?: {
            type: string;
            content?: string | undefined;
            children?: any;
        }[] | undefined;
        icon?: {
            type: "emoji" | "external" | "file";
            url?: string | undefined;
            emoji?: string | undefined;
        } | undefined;
        cover?: {
            type: "external" | "file";
            url?: string | undefined;
        } | undefined;
    }, {
        title: string;
        content?: string | undefined;
        parentId?: string | undefined;
        databaseId?: string | undefined;
        properties?: Record<string, any> | undefined;
        children?: {
            type: string;
            content?: string | undefined;
            children?: any;
        }[] | undefined;
        icon?: {
            type: "emoji" | "external" | "file";
            url?: string | undefined;
            emoji?: string | undefined;
        } | undefined;
        cover?: {
            type: "external" | "file";
            url?: string | undefined;
        } | undefined;
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
    private createNotionPage;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error): Promise<void>;
}
//# sourceMappingURL=notion.d.ts.map