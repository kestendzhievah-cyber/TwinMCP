import Redis from 'ioredis';
import { RateLimitConfig, RateLimitResult } from './types';

export class RateLimitingService {
  constructor(
    private redis: Redis,
    private config: RateLimitConfig
  ) {}

  async checkRateLimit(
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const finalConfig = { ...this.config, ...config };
    const key = `rate-limit:${finalConfig.keyGenerator}:${identifier}`;
    const now = Date.now();

    // Sliding window implementation
    if (finalConfig.strategy === 'sliding-window') {
      return this.checkSlidingWindow(key, finalConfig, now);
    }

    // Token bucket implementation
    if (finalConfig.strategy === 'token-bucket') {
      return this.checkTokenBucket(key, finalConfig, now);
    }

    // Fixed window implementation (fallback)
    return this.checkFixedWindow(key, finalConfig, now);
  }

  private async checkSlidingWindow(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const windowStart = now - config.windowMs;
    
    // Remove expired entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const current = await this.redis.zcard(key);
    
    if (current >= config.maxRequests) {
      const oldestRequest = await this.redis.zrange(key, 0, 0);
      const resetTime = parseInt(oldestRequest[0] || '0') + config.windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(resetTime),
        retryAfter,
        headers: this.buildHeaders(config.maxRequests, 0, resetTime, retryAfter)
      };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(config.windowMs / 1000));

    const remaining = config.maxRequests - current - 1;
    const resetTime = now + config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime: new Date(resetTime),
      headers: this.buildHeaders(config.maxRequests, remaining, resetTime)
    };
  }

  private async checkTokenBucket(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const bucketKey = `token-bucket:${key}`;
    
    // Get current bucket state
    const bucket = await this.redis.hmget(bucketKey, 'tokens', 'lastRefill');
    
    let tokens = parseInt(bucket[0] || config.maxRequests.toString());
    let lastRefill = parseInt(bucket[1] || '0');
    
    // Refill tokens based on time elapsed
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor((timePassed / config.windowMs) * config.maxRequests);
    
    tokens = Math.min(config.maxRequests, tokens + tokensToAdd);
    lastRefill = now;
    
    if (tokens <= 0) {
      const retryAfter = Math.ceil(config.windowMs / 1000);
      const resetTime = now + config.windowMs;

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(resetTime),
        retryAfter,
        headers: this.buildHeaders(config.maxRequests, 0, resetTime, retryAfter)
      };
    }

    // Consume one token
    tokens--;
    
    // Update bucket state
    await this.redis.hmset(bucketKey, {
      tokens,
      lastRefill
    });
    await this.redis.expire(bucketKey, Math.ceil(config.windowMs / 1000));

    const remaining = tokens;
    const resetTime = now + config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime: new Date(resetTime),
      headers: this.buildHeaders(config.maxRequests, remaining, resetTime)
    };
  }

  private async checkFixedWindow(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;
    
    const current = await this.redis.incr(windowKey);
    
    if (current === 1) {
      await this.redis.expire(windowKey, Math.ceil(config.windowMs / 1000));
    }

    if (current > config.maxRequests) {
      const windowEnd = (Math.floor(now / config.windowMs) + 1) * config.windowMs;
      const retryAfter = Math.ceil((windowEnd - now) / 1000);

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(windowEnd),
        retryAfter,
        headers: this.buildHeaders(config.maxRequests, 0, windowEnd, retryAfter)
      };
    }

    const remaining = config.maxRequests - current;
    const resetTime = (Math.floor(now / config.windowMs) + 1) * config.windowMs;

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetTime: new Date(resetTime),
      headers: this.buildHeaders(config.maxRequests, remaining, resetTime)
    };
  }

  private buildHeaders(
    limit: number,
    remaining: number,
    resetTime: number,
    retryAfter?: number
  ): RateLimitResult['headers'] {
    const headers: RateLimitResult['headers'] = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString()
    };

    if (retryAfter) {
      headers['X-RateLimit-Retry-After'] = retryAfter.toString();
    }

    return headers;
  }

  async resetRateLimit(identifier: string, keyGenerator: string): Promise<void> {
    const pattern = `rate-limit:${keyGenerator}:${identifier}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getCurrentUsage(
    identifier: string,
    keyGenerator: string,
    windowMs: number
  ): Promise<number> {
    const key = `rate-limit:${keyGenerator}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    await this.redis.zremrangebyscore(key, 0, windowStart);
    return this.redis.zcard(key);
  }
}
