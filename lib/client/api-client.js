"use strict";
// Client API pour communiquer avec le backend TwinMCP
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
class ApiClient {
    baseUrl;
    apiKey = null;
    constructor() {
        this.baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://api.twinmcp.com'
            : 'http://localhost:3000';
    }
    // Méthodes pour gérer l'authentification
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('twinmcp_api_key', apiKey);
    }
    getApiKey() {
        if (this.apiKey) {
            return this.apiKey;
        }
        return localStorage.getItem('twinmcp_api_key');
    }
    clearApiKey() {
        this.apiKey = null;
        localStorage.removeItem('twinmcp_api_key');
    }
    // Méthode générique pour les requêtes API
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const apiKey = this.getApiKey();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }
        const config = {
            ...options,
            headers,
        };
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    // Méthodes spécifiques pour les clés API
    async getApiKeys() {
        return this.request('/api/api-keys');
    }
    async createApiKey(name) {
        return this.request('/api/api-keys', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    }
    async revokeApiKey(keyId) {
        return this.request(`/api/api-keys/${keyId}`, {
            method: 'DELETE',
        });
    }
    // Méthodes pour les outils MCP
    async resolveLibraryId(params) {
        return this.request('/api/mcp/resolve-library-id', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    async queryDocs(params) {
        return this.request('/api/mcp/query-docs', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    // Méthode pour vérifier la connexion
    async healthCheck() {
        return this.request('/api/health');
    }
}
exports.apiClient = new ApiClient();
exports.default = exports.apiClient;
//# sourceMappingURL=api-client.js.map