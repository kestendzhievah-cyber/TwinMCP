// Client API pour communiquer avec le backend TwinMCP

class ApiClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.twinmcp.com' 
      : 'http://localhost:3000';
  }

  // Méthodes pour gérer l'authentification
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('twinmcp_api_key', apiKey);
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) {
      return this.apiKey;
    }
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('twinmcp_api_key');
      } catch {
        return null;
      }
    }
    return null;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('twinmcp_api_key');
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  // Méthode générique pour les requêtes API
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const apiKey = this.getApiKey();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const config: RequestInit = {
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

  async createApiKey(name: string) {
    return this.request('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async revokeApiKey(keyId: string) {
    return this.request(`/api/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // Méthodes pour les outils MCP
  async resolveLibraryId(params: {
    query: string;
    context?: {
      language?: string;
      framework?: string;
      ecosystem?: string;
    };
    limit?: number;
    include_aliases?: boolean;
  }) {
    return this.request('/api/mcp/resolve-library-id', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async queryDocs(params: {
    library_id: string;
    query: string;
    version?: string;
    max_results?: number;
    include_code?: boolean;
    context_limit?: number;
  }) {
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

export const apiClient = new ApiClient();
export default apiClient;
