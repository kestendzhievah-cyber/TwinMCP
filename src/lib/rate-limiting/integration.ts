import { RateLimitingMiddleware } from './middleware';
import { RateLimitingService } from './rate-limiting.service';
import { QuotaService } from './quota.service';
import { RATE_LIMIT_CONFIGS } from './plans';
import Redis from 'ioredis';

/**
 * Factory: create the rate-limiting stack from a Redis instance.
 * Returns the middleware, service, and quota service for use in Next.js API routes.
 */
export function createRateLimitingStack(redis: Redis) {
  const rateLimitingService = new RateLimitingService(redis, RATE_LIMIT_CONFIGS.ip);
  const quotaService = new QuotaService(redis);
  const middleware = new RateLimitingMiddleware(rateLimitingService, quotaService);

  return { rateLimitingService, quotaService, middleware };
}

/** @deprecated Use createRateLimitingStack instead. Legacy signature accepts (server, redis) for backward compat. */
export function setupRateLimiting(_server: any, redis: Redis) {
  return createRateLimitingStack(redis);
}
