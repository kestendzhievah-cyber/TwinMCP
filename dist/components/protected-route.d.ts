interface ProtectedRouteProps {
    children: React.ReactNode;
    redirectTo?: string;
}
export default function ProtectedRoute({ children, redirectTo }: ProtectedRouteProps): import("react").JSX.Element | null;
export declare function AuthenticatedContent({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element | null;
export declare function UnauthenticatedContent({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=protected-route.d.ts.map