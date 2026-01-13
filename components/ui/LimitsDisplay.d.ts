import React from 'react';
interface LimitsDisplayProps {
    limits: {
        agents: {
            current: number;
            max: number;
            remaining: number;
            percentage: number;
        };
        conversations: {
            current: number;
            max: number;
            remaining: number;
            percentage: number;
        };
    };
    showUpgradeButton?: boolean;
    onUpgrade?: () => void;
}
export declare function LimitsDisplay({ limits, showUpgradeButton, onUpgrade }: LimitsDisplayProps): React.JSX.Element;
export {};
//# sourceMappingURL=LimitsDisplay.d.ts.map