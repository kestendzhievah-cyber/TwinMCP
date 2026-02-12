import React from 'react';
interface LimitReachedModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        current: number;
        max: number;
        plan: string;
        suggestedPlan: string | null;
        message: string;
    };
    onManageAgents: () => void;
    onUpgrade: () => void;
}
export declare function LimitReachedModal({ isOpen, onClose, data, onManageAgents, onUpgrade }: LimitReachedModalProps): React.JSX.Element | null;
export {};
//# sourceMappingURL=LimitReachedModal.d.ts.map