import { z } from 'zod';
import { MCPTool, ValidationResult, ExecutionResult } from '../../core';
export declare class CalendarTool implements MCPTool {
    id: string;
    name: string;
    version: string;
    category: 'productivity';
    description: string;
    author: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig: string[];
    inputSchema: z.ZodEffects<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        calendarId: z.ZodOptional<z.ZodString>;
        maxResults: z.ZodDefault<z.ZodNumber>;
        singleEvents: z.ZodDefault<z.ZodBoolean>;
        orderBy: z.ZodDefault<z.ZodEnum<["startTime", "updated"]>>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        maxResults: number;
        singleEvents: boolean;
        orderBy: "startTime" | "updated";
        calendarId?: string | undefined;
    }, {
        startDate: string;
        endDate: string;
        calendarId?: string | undefined;
        maxResults?: number | undefined;
        singleEvents?: boolean | undefined;
        orderBy?: "startTime" | "updated" | undefined;
    }>, {
        startDate: string;
        endDate: string;
        maxResults: number;
        singleEvents: boolean;
        orderBy: "startTime" | "updated";
        calendarId?: string | undefined;
    }, {
        startDate: string;
        endDate: string;
        calendarId?: string | undefined;
        maxResults?: number | undefined;
        singleEvents?: boolean | undefined;
        orderBy?: "startTime" | "updated" | undefined;
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
    private readCalendarEvents;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error): Promise<void>;
}
//# sourceMappingURL=calendar.d.ts.map