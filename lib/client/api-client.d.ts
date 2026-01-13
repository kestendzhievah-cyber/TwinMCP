declare class ApiClient {
    private baseUrl;
    private apiKey;
    constructor();
    setApiKey(apiKey: string): void;
    getApiKey(): string | null;
    clearApiKey(): void;
    private request;
    getApiKeys(): Promise<any>;
    createApiKey(name: string): Promise<any>;
    revokeApiKey(keyId: string): Promise<any>;
    resolveLibraryId(params: {
        query: string;
        context?: {
            language?: string;
            framework?: string;
            ecosystem?: string;
        };
        limit?: number;
        include_aliases?: boolean;
    }): Promise<any>;
    queryDocs(params: {
        library_id: string;
        query: string;
        version?: string;
        max_results?: number;
        include_code?: boolean;
        context_limit?: number;
    }): Promise<any>;
    healthCheck(): Promise<any>;
}
export declare const apiClient: ApiClient;
export default apiClient;
//# sourceMappingURL=api-client.d.ts.map