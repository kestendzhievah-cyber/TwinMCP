// Client API pour communiquer avec le backend TwinMCP
// Utilise le Firebase ID token pour l'authentification dashboard

import { auth } from '@/lib/firebase'

class ApiClient {
  private apiKey: string | null = null;

  // Obtenir le token Firebase de l'utilisateur connecté
  private async getFirebaseToken(): Promise<string | null> {
    try {
      const currentUser = auth?.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
    } catch {
      // Firebase not ready or user not logged in
    }
    return null;
  }

  // Méthodes pour gérer l'authentification par API key (fallback)
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
    const url = endpoint;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Priorité 1: Firebase token (dashboard users)
    const firebaseToken = await this.getFirebaseToken();
    if (firebaseToken) {
      headers['Authorization'] = `Bearer ${firebaseToken}`;
    } else {
      // Priorité 2: API key (programmatic access)
      const apiKey = this.getApiKey();
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
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
    return this.request(`/api/api-keys?id=${encodeURIComponent(keyId)}`, {
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
