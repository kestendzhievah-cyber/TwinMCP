// Client API pour la gestion des clés API TwinMCP
import { logger } from '@/lib/logger'

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

class ApiKeysClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    // Récupérer la clé API depuis le localStorage ou le contexte d'authentification
    this.apiKey = this.getStoredApiKey();
  }

  private getStoredApiKey(): string | null {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('twinmcp_admin_api_key') || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private setStoredApiKey(apiKey: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('twinmcp_admin_api_key', apiKey);
      } catch {
        // Ignore
      }
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.setStoredApiKey(apiKey);
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
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
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async getApiKeys(): Promise<ApiKeyResponse[]> {
    const response = await this.makeRequest<ApiKeyResponse[]>('/api-keys');
    return response.data || [];
  }

  async createApiKey(name: string): Promise<CreateApiKeyResponse> {
    const response = await this.makeRequest<CreateApiKeyResponse>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    
    if (!response.data) {
      throw new Error('Failed to create API key');
    }
    
    return response.data;
  }

  async revokeApiKey(keyId: string): Promise<void> {
    await this.makeRequest(`/api-keys?id=${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
  }

  // Pour le développement, simuler une clé API admin
  async simulateAdminAuth(): Promise<void> {
    // En développement, on peut simuler une authentification
    if (process.env.NODE_ENV === 'development') {
      // Utiliser une clé de test ou générer une fausse clé pour le développement
      const testApiKey = 'twinmcp_live_development_test_key_12345';
      this.setApiKey(testApiKey);
    }
  }
}

export const apiKeysClient = new ApiKeysClient();
export type { ApiKeyResponse, CreateApiKeyRequest, CreateApiKeyResponse, ApiResponse };
