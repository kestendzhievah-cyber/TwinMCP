import React, { ReactNode } from 'react';
interface User {
    id: string;
    email: string;
    name?: string;
    apiKey?: string;
}
interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
    setApiKey: (apiKey: string) => void;
}
export declare function AuthProvider({ children }: {
    children: ReactNode;
}): React.JSX.Element;
export declare function useAuth(): AuthContextType;
export {};
//# sourceMappingURL=auth-provider.d.ts.map