interface PlanConfig {
    [key: string]: {
        agents: number;
        conversations: number;
        models: string[];
        features: string[];
        support: string;
        price: number;
    };
}
export declare const PLAN_CONFIG: PlanConfig;
export declare function getPlanConfig(plan: keyof PlanConfig): {
    agents: number;
    conversations: number;
    models: string[];
    features: string[];
    support: string;
    price: number;
} | undefined;
export declare function getSuggestedUpgrade(currentPlan: keyof PlanConfig): keyof PlanConfig | null;
export declare function isUnlimited(value: number): boolean;
export declare function formatLimit(value: number, unit?: string): string;
export {};
//# sourceMappingURL=plan-config.d.ts.map