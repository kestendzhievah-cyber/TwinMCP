export interface RateLimitConfig {
  windowMs: number;        // Fenêtre de temps en millisecondes
  maxRequests: number;      // Nombre maximum de requêtes
  keyGenerator: string;     // Générateur de clé (ip, user, api-key)
  strategy: 'sliding-window' | 'fixed-window' | 'token-bucket';
}

export interface QuotaConfig {
  daily: number;            // Quota quotidien
  monthly: number;          // Quota mensuel
  burst: number;           // Pic autorisé
  concurrent: number;      // Requêtes simultanées
}

export interface UserQuota {
  userId: string;
  plan: 'free' | 'premium' | 'enterprise';
  quotas: QuotaConfig;
  currentUsage: {
    daily: number;
    monthly: number;
    burst: number;
    concurrent: number;
  };
  resetTimes: {
    daily: Date;
    monthly: Date;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  headers: {
    'X-RateLimit-Limit': string;
    'X-RateLimit-Remaining': string;
    'X-RateLimit-Reset': string;
    'X-RateLimit-Retry-After'?: string;
  };
}

export interface QuotaResult {
  allowed: boolean;
  quotas: QuotaConfig;
  usage: {
    daily: number;
    monthly: number;
    concurrent: number;
  };
  headers: Record<string, string>;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  topUsers: Array<{ userId: string; requests: number }>;
  topIPs: Array<{ ip: string; requests: number }>;
  averageRPS: number;
}

export interface QuotaUsage {
  userId: string;
  plan: string;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  percentage: number;
}

// Request context types (framework-agnostic)
export interface RequestContext {
  user?: {
    id: string;
    plan: string;
  };
  apiKey?: {
    id: string;
  };
  requestId?: string;
}
