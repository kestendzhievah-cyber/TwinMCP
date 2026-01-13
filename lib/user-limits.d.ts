interface LimitInfo {
    current: number;
    max: number;
    remaining: number;
}
export interface UserLimitsResponse {
    plan: string;
    limits: {
        agents: LimitInfo;
        conversations: LimitInfo;
    };
    canCreateAgent: boolean;
    suggestedUpgrade: string | null;
    subscriptionStatus?: string;
}
export declare function canCreateAgent(userId: string): Promise<{
    allowed: boolean;
    currentCount?: number;
    limit?: number;
    message?: string;
    plan?: string;
    maxAllowed?: number;
    suggestedUpgrade?: string | null;
}>;
export declare function countActiveAgents(userId: string): Promise<number>;
export declare function getUserLimits(userId: string): Promise<UserLimitsResponse>;
export declare function updateUserAgentsCount(userId: string, newCount: number): Promise<void>;
export {};
//# sourceMappingURL=user-limits.d.ts.map