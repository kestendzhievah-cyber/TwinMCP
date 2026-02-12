import { RateLimitConfig } from './types';

export const QUOTA_PLANS = {
  free: {
    daily: 200,
    monthly: 6000,
    burst: 10,
    concurrent: 2,
    mcpServers: 3,
    privateServers: false,
  },
  professional: {
    daily: 10000,
    monthly: 300000,
    burst: 100,
    concurrent: 20,
    mcpServers: -1, // Illimité
    privateServers: true,
  },
  enterprise: {
    daily: -1, // Illimité
    monthly: -1, // Illimité
    burst: 500,
    concurrent: 100,
    mcpServers: -1, // Illimité
    privateServers: true,
  },
} as const;

export const RATE_LIMIT_CONFIGS = {
  ip: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: 'ip',
    strategy: 'sliding-window' as const,
  },
  user: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    keyGenerator: 'user',
    strategy: 'sliding-window' as const,
  },
  api_key: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5000,
    keyGenerator: 'api-key',
    strategy: 'sliding-window' as const,
  },
} as const;

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = RATE_LIMIT_CONFIGS.ip;

export const MONITORING_CONFIG = {
  statsRetention: {
    hour: 3600, // 1 hour in seconds
    day: 86400, // 1 day in seconds
    week: 604800, // 1 week in seconds
  },
  alertThresholds: {
    blockRate: 0.05, // 5%
    latency: 10, // 10ms
    quotaUsage: 0.8, // 80%
  },
} as const;

export type PlanType = keyof typeof QUOTA_PLANS;
export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;
