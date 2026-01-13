interface ApiKeyResponse {
    id: string;
    keyPrefix: string;
    name: string;
    quotaRequestsPerMinute: number;
    quotaRequestsPerDay: number;
    lastUsedAt?: string;
    createdAt: string;
    usage?: {
        requestsToday: number;
        requestsThisHour: number;
        successRate: number;
    };
}
interface CreateApiKeyRequest {
    name: string;
}
interface CreateApiKeyResponse {
    id: string;
    keyPrefix: string;
    name: string;
    quotaRequestsPerMinute: number;
    quotaRequestsPerDay: number;
    createdAt: string;
    usage: {
        requestsToday: number;
        requestsThisHour: number;
        successRate: number;
    };
}
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    message?: string;
}
declare class ApiKeysClient {
    private baseUrl;
    private apiKey;
    constructor(baseUrl?: string);
    private getStoredApiKey;
    private setStoredApiKey;
    setApiKey(apiKey: string): void;
    private makeRequest;
    getApiKeys(): Promise<ApiKeyResponse[]>;
    createApiKey(name: string): Promise<CreateApiKeyResponse>;
    revokeApiKey(keyId: string): Promise<void>;
    simulateAdminAuth(): Promise<void>;
}
export declare const apiKeysClient: ApiKeysClient;
export type { ApiKeyResponse, CreateApiKeyRequest, CreateApiKeyResponse, ApiResponse };
//# sourceMappingURL=api-keys-client.d.ts.map