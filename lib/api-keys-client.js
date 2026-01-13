"use strict";
// Client API pour la gestion des clés API TwinMCP
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeysClient = void 0;
class ApiKeysClient {
    baseUrl;
    apiKey = null;
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        // Récupérer la clé API depuis le localStorage ou le contexte d'authentification
        this.apiKey = this.getStoredApiKey();
    }
    getStoredApiKey() {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('twinmcp_admin_api_key') || null;
        }
        return null;
    }
    setStoredApiKey(apiKey) {
        if (typeof window !== 'undefined') {
            localStorage.setItem('twinmcp_admin_api_key', apiKey);
        }
    }
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.setStoredApiKey(apiKey);
    }
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        // Ajouter l'authentification si disponible
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            headers['x-api-key'] = this.apiKey;
        }
        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }
            return data;
        }
        catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    async getApiKeys() {
        const response = await this.makeRequest('/api-keys');
        return response.data || [];
    }
    async createApiKey(name) {
        const response = await this.makeRequest('/api-keys', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
        if (!response.data) {
            throw new Error('Failed to create API key');
        }
        return response.data;
    }
    async revokeApiKey(keyId) {
        await this.makeRequest(`/api-keys/${keyId}`, {
            method: 'DELETE',
        });
    }
    // Pour le développement, simuler une clé API admin
    async simulateAdminAuth() {
        // En développement, on peut simuler une authentification
        if (process.env.NODE_ENV === 'development') {
            // Utiliser une clé de test ou générer une fausse clé pour le développement
            const testApiKey = 'twinmcp_live_development_test_key_12345';
            this.setApiKey(testApiKey);
        }
    }
}
exports.apiKeysClient = new ApiKeysClient();
//# sourceMappingURL=api-keys-client.js.map