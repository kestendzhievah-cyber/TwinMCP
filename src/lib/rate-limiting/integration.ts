import { RateLimitingMiddleware } from './middleware';
import { RateLimitingService } from './rate-limiting.service';
import { QuotaService } from './quota.service';
import { RATE_LIMIT_CONFIGS, QUOTA_PLANS } from './plans';
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

/**
 * Register rate-limiting Fastify routes and hooks on the given server instance.
 * Used by the MCP HTTP server and integration tests.
 */
export async function setupRateLimiting(server: any, redis: Redis) {
  const rateLimitingService = new RateLimitingService(redis, RATE_LIMIT_CONFIGS.ip);
  const quotaService = new QuotaService(redis);

  // ── Global onRequest hook: IP rate limiting ──
  server.addHook('onRequest', async (request: any, reply: any) => {
    try {
      const ip = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
      const result = await rateLimitingService.checkRateLimit(ip, RATE_LIMIT_CONFIGS.ip);

      // Always set rate-limit headers
      reply.header('x-ratelimit-limit', result.limit.toString());
      reply.header('x-ratelimit-remaining', result.remaining.toString());
      reply.header('x-ratelimit-reset', result.resetTime.toISOString());

      if (!result.allowed) {
        reply.header('x-ratelimit-retry-after', (result.retryAfter || 60).toString());
        reply.status(429).send({ error: 'Too Many Requests', message: 'Rate limit exceeded', retryAfter: result.retryAfter });
        return;
      }
    } catch {
      // On Redis error, let the request through (fail-open)
    }
  });

  // ── Global onResponse hook: quota headers for authenticated users ──
  server.addHook('preHandler', async (request: any, reply: any) => {
    const user = (request as any).user;
    if (!user) return;

    try {
      const plan = (user.plan in QUOTA_PLANS ? user.plan : 'free') as keyof typeof QUOTA_PLANS;
      const quotaResult = await quotaService.checkUserQuota(user.id, plan);

      // Set quota headers
      Object.entries(quotaResult.headers).forEach(([k, v]) => {
        reply.header(k.toLowerCase(), v);
      });

      if (!quotaResult.allowed) {
        reply.status(402).send({ error: 'Payment Required', message: 'Quota exceeded', quotaType: quotaResult.headers['X-Quota-Exceeded'] });
        return;
      }

      await quotaService.incrementUsage(user.id);
    } catch {
      // On error, let the request through
    }
  });

  // ── GET /rate-limit/info ──
  server.get('/rate-limit/info', async (request: any, reply: any) => {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!user.id) {
      reply.status(400).send({ error: 'Bad Request', message: 'Malformed user data' });
      return;
    }

    const plan = (user.plan in QUOTA_PLANS ? user.plan : 'free') as keyof typeof QUOTA_PLANS;
    const ip = request.ip || '127.0.0.1';
    const ipUsage = await rateLimitingService.getCurrentUsage(ip, 'ip', RATE_LIMIT_CONFIGS.ip.windowMs);
    const quotaInfo = await quotaService.getUserQuotaInfo(user.id, plan);

    // Check and enforce quota, set headers on the response
    const quotaResult = await quotaService.checkUserQuota(user.id, plan);
    Object.entries(quotaResult.headers).forEach(([k, v]) => {
      reply.header(k.toLowerCase(), v);
    });

    if (!quotaResult.allowed) {
      reply.status(402).send({ error: 'Payment Required', message: 'Quota exceeded', quotaType: quotaResult.headers['X-Quota-Exceeded'] });
      return;
    }

    return {
      rateLimits: {
        ip: { current: ipUsage, limit: RATE_LIMIT_CONFIGS.ip.maxRequests, windowMs: RATE_LIMIT_CONFIGS.ip.windowMs },
        user: { limit: RATE_LIMIT_CONFIGS.user.maxRequests, windowMs: RATE_LIMIT_CONFIGS.user.windowMs },
      },
      quotas: quotaInfo,
    };
  });

  // ── POST /admin/rate-limit/reset/:userId ──
  server.post('/admin/rate-limit/reset/:userId', async (request: any, reply: any) => {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }
    if (user.plan !== 'enterprise') {
      reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
      return;
    }

    const targetUserId = (request.params as any).userId;
    await rateLimitingService.resetRateLimit(targetUserId, 'user');
    await quotaService.resetUserQuota(targetUserId);

    return { message: 'Rate limits reset successfully', userId: targetUserId };
  });

  // ── GET /admin/rate-limit/stats ──
  server.get('/admin/rate-limit/stats', async (request: any, reply: any) => {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }
    if (user.plan !== 'enterprise') {
      reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
      return;
    }

    return { message: 'Statistics endpoint — aggregated stats' };
  });

  return { rateLimitingService, quotaService };
}
