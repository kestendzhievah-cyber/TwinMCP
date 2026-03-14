// Client API pour communiquer avec le backend TwinMCP
// Utilise le Firebase ID token pour l'authentification dashboard

import { auth } from '@/lib/firebase';

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
        // Use sessionStorage (cleared on tab close) instead of localStorage (persists, XSS-vulnerable)
        sessionStorage.setItem('twinmcp_api_key', apiKey);
      } catch {
        // Ignore storage errors
      }
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) {
      return this.apiKey;
    }
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('twinmcp_api_key');
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
        sessionStorage.removeItem('twinmcp_api_key');
      } catch {
        // Ignore storage errors
      }
    }
  }

  // Méthode générique pour les requêtes API
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    const data = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }));

    if (!response.ok) {
      // Return the error payload so callers can check .code and .error
      return { success: false, error: data.error || `HTTP ${response.status}: ${response.statusText}`, code: data.code, status: response.status, ...data };
    }

    return data;
  }

  // Méthodes spécifiques pour les clés API
  async getApiKeys() {
    return this.request('/api/api-keys');
  }

  async createApiKey(name: string, expiresIn?: string) {
    return this.request('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, ...(expiresIn && { expiresIn }) }),
    });
  }

  async revokeApiKey(keyId: string) {
    return this.request(`/api/api-keys?id=${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
  }

  async renameApiKey(keyId: string, name: string) {
    return this.request(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async getKeyDetail(keyId: string) {
    return this.request(`/api/v1/api-keys/${encodeURIComponent(keyId)}`);
  }

  async getKeyUsage(keyId: string, days: number = 30) {
    return this.request(`/api/v1/api-keys/${encodeURIComponent(keyId)}/usage?days=${days}`);
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
