export interface APIKey {
  id: string;
  name: string;
  key_hash: string;
  user_id: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  quota_daily: number;
  quota_monthly: number;
  used_daily: number;
  used_monthly: number;
  last_used_at: Date;
  expires_at?: Date;
  is_active: boolean;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface APIKeyUsage {
  key_id: string;
  date: string;
  requests_count: number;
  tokens_used: number;
  last_request_at: Date;
}

export interface QuotaConfig {
  free: {
    daily: number;
    monthly: number;
    rate_limit: number;
  };
  basic: {
    daily: number;
    monthly: number;
    rate_limit: number;
  };
  premium: {
    daily: number;
    monthly: number;
    rate_limit: number;
  };
  enterprise: {
    daily: number;
    monthly: number;
    rate_limit: number;
  };
}

export interface APIKeyValidationResult {
  valid: boolean;
  apiKey?: APIKey;
  error?: string;
  message?: string;
  fromCache?: boolean;
}

export interface CreateAPIKeyData {
  name: string;
  user_id: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  permissions?: string[];
  expires_at?: Date;
}

export interface QuotaCheckResult {
  has_quota: boolean;
  daily_used: number;
  daily_limit: number;
  daily_remaining: number;
  monthly_used: number;
  monthly_limit: number;
  monthly_remaining: number;
  reset_daily: Date;
  reset_monthly: Date;
}

export interface UsageHistoryItem {
  date: string;
  requests_count: number;
  tokens_used: number;
  last_request_at: Date;
}

export interface APIKeyCreateRequest {
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  permissions?: string[];
  expires_at?: Date;
}

export interface APIKeyResponse {
  id: string;
  name: string;
  tier: string;
  quota_daily: number;
  quota_monthly: number;
  used_daily: number;
  used_monthly: number;
  last_used_at?: Date;
  expires_at?: Date;
  is_active: boolean;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface APIKeyCreateResponse extends APIKeyResponse {
  api_key: string;
}

export interface UsageStatsResponse {
  daily_used: number;
  daily_limit: number;
  daily_remaining: number;
  monthly_used: number;
  monthly_limit: number;
  monthly_remaining: number;
  reset_daily: Date;
  reset_monthly: Date;
  usage_history: UsageHistoryItem[];
}
