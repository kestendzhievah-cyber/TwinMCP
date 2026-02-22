/**
 * Rate Limiting Middleware
 * Uses Redis for distributed rate limiting
 * Configurable limits per IP and per user
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyPrefix?: string;    // Redis key prefix
  skipSuccessful?: boolean; // Skip counting successful requests
  message?: string;      // Custom error message
}

// Default config: 60 requests per minute
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 60,       // 60 requests
  keyPrefix: 'ratelimit',
  message: 'Trop de requêtes. Veuillez réessayer dans quelques instants.'
};

// Different configs for different routes
export const RATE_LIMIT_CONFIGS = {
  // Auth routes - more strict
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:auth',
    message: 'Trop de tentatives de connexion. Veuillez réessayer dans une minute.'
  },
  // API routes - standard
  api: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'ratelimit:api',
    message: 'Limite de requêtes API atteinte. Veuillez réessayer dans une minute.'
  },
  // Heavy operations - stricter
  heavy: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:heavy',
    message: 'Limite d\'opérations atteinte. Veuillez réessayer dans une minute.'
  }
};

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Get client identifier (IP or user ID)
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try to get real IP from headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

/**
 * Check rate limit using Redis
 */
export async function checkRateLimit(
  redis: Redis,
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${config.keyPrefix || 'ratelimit'}:${identifier}`;

  try {
    // Use sorted set for sliding window rate limiting
    const multi = redis.multi();
    
    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    multi.zcard(key);
    
    // Add current request
    multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
    
    // Set expiry
    multi.expire(key, Math.ceil(config.windowMs / 1000) + 1);
    
    const results = await multi.exec();
    
    if (!results) {
      return { success: true, remaining: config.maxRequests, resetTime: now + config.windowMs, limit: config.maxRequests };
    }

    const currentCount = (results[1][1] as number) || 0;
    const remaining = Math.max(0, config.maxRequests - currentCount - 1);
    const resetTime = now + config.windowMs;

    return {
      success: currentCount < config.maxRequests,
      remaining,
      resetTime,
      limit: config.maxRequests
    };
    
  } catch (error) {
    logger.error('[RateLimit] Redis error:', error);
    // On error, allow the request (fail open)
    return { success: true, remaining: config.maxRequests, resetTime: now + config.windowMs, limit: config.maxRequests };
  }
}

/**
 * Create rate limit response with headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: message || 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    },
    { status: 429 }
  );

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  response.headers.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());

  return response;
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  return response;
}

/**
 * Rate limit middleware function
 */
export function createRateLimitMiddleware(redis: Redis, config?: RateLimitConfig) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async function rateLimitMiddleware(
    request: NextRequest,
    userId?: string
  ): Promise<{ allowed: boolean; result: RateLimitResult; response?: NextResponse }> {
    const identifier = getClientIdentifier(request, userId);
    const result = await checkRateLimit(redis, identifier, finalConfig);

    if (!result.success) {
      return {
        allowed: false,
        result,
        response: createRateLimitResponse(result, finalConfig.message)
      };
    }

    return { allowed: true, result };
  };
}

/**
 * Simple in-memory rate limiter for fallback
 */
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now();
  const key = `${config.keyPrefix || 'ratelimit'}:${identifier}`;
  
  let entry = inMemoryStore.get(key);
  
  // Clean expired entries periodically
  if (inMemoryStore.size > 10000) {
    for (const [k, v] of inMemoryStore) {
      if (v.resetTime < now) {
        inMemoryStore.delete(k);
      }
    }
  }
  
  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + config.windowMs };
    inMemoryStore.set(key, entry);
  }
  
  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    success: entry.count <= config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
    limit: config.maxRequests
  };
}
