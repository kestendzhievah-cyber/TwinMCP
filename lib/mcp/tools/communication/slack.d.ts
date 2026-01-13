import { z } from 'zod';
import { MCPTool, ValidationResult, ExecutionResult } from '../../core';
export declare class SlackTool implements MCPTool {
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
        channel: z.ZodString;
        text: z.ZodString;
        thread_ts: z.ZodOptional<z.ZodString>;
        blocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            text: z.ZodOptional<z.ZodObject<{
                type: z.ZodUnion<[z.ZodLiteral<"plain_text">, z.ZodLiteral<"mrkdwn">]>;
                text: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "plain_text" | "mrkdwn";
                text: string;
            }, {
                type: "plain_text" | "mrkdwn";
                text: string;
            }>>;
            elements: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            text?: {
                type: "plain_text" | "mrkdwn";
                text: string;
            } | undefined;
            elements?: any;
        }, {
            type: string;
            text?: {
                type: "plain_text" | "mrkdwn";
                text: string;
            } | undefined;
            elements?: any;
        }>, "many">>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            color: z.ZodOptional<z.ZodString>;
            title: z.ZodOptional<z.ZodString>;
            text: z.ZodOptional<z.ZodString>;
            fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
                title: z.ZodString;
                value: z.ZodString;
                short: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                value: string;
                title: string;
                short?: boolean | undefined;
            }, {
                value: string;
                title: string;
                short?: boolean | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            text?: string | undefined;
            color?: string | undefined;
            title?: string | undefined;
            fields?: {
                value: string;
                title: string;
                short?: boolean | undefined;
            }[] | undefined;
        }, {
            text?: string | undefined;
            color?: string | undefined;
            title?: string | undefined;
            fields?: {
                value: string;
                title: string;
                short?: boolean | undefined;
            }[] | undefined;
        }>, "many">>;
        username: z.ZodOptional<z.ZodString>;
        icon_emoji: z.ZodOptional<z.ZodString>;
        icon_url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        channel: string;
        text: string;
        attachments?: {
            text?: string | undefined;
            color?: string | undefined;
            title?: string | undefined;
            fields?: {
                value: string;
                title: string;
                short?: boolean | undefined;
            }[] | undefined;
        }[] | undefined;
        thread_ts?: string | undefined;
        blocks?: {
            type: string;
            text?: {
                type: "plain_text" | "mrkdwn";
                text: string;
            } | undefined;
            elements?: any;
        }[] | undefined;
        username?: string | undefined;
        icon_emoji?: string | undefined;
        icon_url?: string | undefined;
    }, {
        channel: string;
        text: string;
        attachments?: {
            text?: string | undefined;
            color?: string | undefined;
            title?: string | undefined;
            fields?: {
                value: string;
                title: string;
                short?: boolean | undefined;
            }[] | undefined;
        }[] | undefined;
        thread_ts?: string | undefined;
        blocks?: {
            type: string;
            text?: {
                type: "plain_text" | "mrkdwn";
                text: string;
            } | undefined;
            elements?: any;
        }[] | undefined;
        username?: string | undefined;
        icon_emoji?: string | undefined;
        icon_url?: string | undefined;
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
    private sendSlackMessage;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error): Promise<void>;
}
//# sourceMappingURL=slack.d.ts.map