import React from 'react';
interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg';
    className?: string;
}
export declare function Button({ children, onClick, disabled, type, variant, size, className }: ButtonProps): React.JSX.Element;
export {};
//# sourceMappingURL=button.d.ts.map