import { RateLimitConfig, QuotaConfig } from './types';

export const QUOTA_PLANS = {
  free: {
    daily: 100,
    monthly: 3000,
    burst: 10,
    concurrent: 2
  },
  premium: {
    daily: 1000,
    monthly: 30000,
    burst: 50,
    concurrent: 10
  },
  enterprise: {
    daily: 10000,
    monthly: 300000,
    burst: 200,
    concurrent: 50
  }
} as const;

export const RATE_LIMIT_CONFIGS = {
  ip: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: 'ip',
    strategy: 'sliding-window' as const
  },
  user: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    keyGenerator: 'user',
    strategy: 'sliding-window' as const
  },
  api_key: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5000,
    keyGenerator: 'api-key',
    strategy: 'sliding-window' as const
  }
} as const;

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = RATE_LIMIT_CONFIGS.ip;

export const MONITORING_CONFIG = {
  statsRetention: {
    hour: 3600,      // 1 hour in seconds
    day: 86400,      // 1 day in seconds
    week: 604800     // 1 week in seconds
  },
  alertThresholds: {
    blockRate: 0.05,      // 5%
    latency: 10,          // 10ms
    quotaUsage: 0.80      // 80%
  }
} as const;

export type PlanType = keyof typeof QUOTA_PLANS;
export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;
