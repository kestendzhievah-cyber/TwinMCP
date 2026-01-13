import React from 'react';
interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    chatbotName: string;
    isDeleting?: boolean;
}
export declare function ConfirmDeleteModal({ isOpen, onClose, onConfirm, chatbotName, isDeleting }: ConfirmDeleteModalProps): React.JSX.Element | null;
export {};
//# sourceMappingURL=ConfirmDeleteModal.d.ts.map