import React from 'react';
interface CardProps {
    children: React.ReactNode;
    className?: string;
}
interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
}
interface CardTitleProps {
    children: React.ReactNode;
    className?: string;
}
interface CardDescriptionProps {
    children: React.ReactNode;
    className?: string;
}
interface CardContentProps {
    children: React.ReactNode;
    className?: string;
}
export declare function Card({ children, className }: CardProps): React.JSX.Element;
export declare function CardHeader({ children, className }: CardHeaderProps): React.JSX.Element;
export declare function CardTitle({ children, className }: CardTitleProps): React.JSX.Element;
export declare function CardDescription({ children, className }: CardDescriptionProps): React.JSX.Element;
export declare function CardContent({ children, className }: CardContentProps): React.JSX.Element;
export {};
//# sourceMappingURL=card.d.ts.map