import { AuthContext, User, ApiKey, Permission } from './auth-types';
export declare class AuthService {
    private users;
    private apiKeys;
    private jwtSecret;
    constructor();
    private initializeDefaultUsers;
    authenticateApiKey(apiKey: string): Promise<AuthContext>;
    authenticateJWT(token: string): Promise<AuthContext>;
    authenticate(request: Request): Promise<AuthContext>;
    authorize(context: AuthContext, toolId: string, action: string, cost?: number): Promise<boolean>;
    generateJWT(userId: string, expiresIn?: string): string;
    generateApiKey(userId: string, name: string, permissions: Permission[]): Promise<string>;
    createUser(email: string, name: string, permissions: Permission[]): Promise<User>;
    private getApiKeyFromRequest;
    private getJWTFromRequest;
    private createAuthError;
    getUsers(): User[];
    getApiKeys(): ApiKey[];
    revokeApiKey(apiKey: string): boolean;
    deactivateUser(userId: string): boolean;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.d.ts.map