import { z } from 'zod';
import { MCPTool, ValidationResult, ExecutionResult } from '../../core';
export declare class GitHubTool implements MCPTool {
    id: string;
    name: string;
    version: string;
    category: 'development';
    description: string;
    author: string;
    tags: string[];
    requiredConfig: string[];
    optionalConfig: string[];
    inputSchema: z.ZodObject<{
        owner: z.ZodString;
        repo: z.ZodString;
        action: z.ZodEnum<["issues", "pulls", "commits", "releases", "create_issue", "create_pr"]>;
        data: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            body: z.ZodOptional<z.ZodString>;
            assignee: z.ZodOptional<z.ZodString>;
            labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            branch: z.ZodOptional<z.ZodString>;
            base: z.ZodOptional<z.ZodString>;
            head: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            body?: string | undefined;
            title?: string | undefined;
            assignee?: string | undefined;
            labels?: string[] | undefined;
            branch?: string | undefined;
            base?: string | undefined;
            head?: string | undefined;
        }, {
            body?: string | undefined;
            title?: string | undefined;
            assignee?: string | undefined;
            labels?: string[] | undefined;
            branch?: string | undefined;
            base?: string | undefined;
            head?: string | undefined;
        }>>;
        limit: z.ZodDefault<z.ZodNumber>;
        state: z.ZodDefault<z.ZodEnum<["open", "closed", "all"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        owner: string;
        repo: string;
        action: "issues" | "pulls" | "commits" | "releases" | "create_issue" | "create_pr";
        state: "open" | "closed" | "all";
        data?: {
            body?: string | undefined;
            title?: string | undefined;
            assignee?: string | undefined;
            labels?: string[] | undefined;
            branch?: string | undefined;
            base?: string | undefined;
            head?: string | undefined;
        } | undefined;
    }, {
        owner: string;
        repo: string;
        action: "issues" | "pulls" | "commits" | "releases" | "create_issue" | "create_pr";
        data?: {
            body?: string | undefined;
            title?: string | undefined;
            assignee?: string | undefined;
            labels?: string[] | undefined;
            branch?: string | undefined;
            base?: string | undefined;
            head?: string | undefined;
        } | undefined;
        limit?: number | undefined;
        state?: "open" | "closed" | "all" | undefined;
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
    private executeGitHubAction;
    private getIssues;
    private getPullRequests;
    private getCommits;
    private getReleases;
    private createIssue;
    private createPullRequest;
    beforeExecute(args: any): Promise<any>;
    afterExecute(result: ExecutionResult): Promise<ExecutionResult>;
    onError(error: Error): Promise<void>;
}
//# sourceMappingURL=github.d.ts.map