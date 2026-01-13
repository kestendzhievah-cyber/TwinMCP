import { FastifyInstance } from 'fastify';
import { RateLimitingMiddleware } from './middleware';
import { RateLimitingService } from './rate-limiting.service';
import { QuotaService } from './quota.service';
import { RATE_LIMIT_CONFIGS, QUOTA_PLANS } from './plans';
import Redis from 'ioredis';

export async function setupRateLimiting(fastify: FastifyInstance, redis: Redis) {
  const rateLimitingService = new RateLimitingService(
    redis,
    RATE_LIMIT_CONFIGS.ip
  );
  
  const quotaService = new QuotaService(redis);
  const middleware = new RateLimitingMiddleware(rateLimitingService, quotaService);

  // Apply IP rate limiting to all requests
  fastify.addHook('preHandler', middleware.ipRateLimit);

  // Apply user/API key rate limiting after authentication
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.user || request.apiKey) {
      await middleware.authenticatedRateLimit(request, reply);
    }
  });

  // Store services for later use
  fastify.decorate('rateLimiting', rateLimitingService);
  fastify.decorate('quota', quotaService);
  fastify.decorate('rateLimitMiddleware', middleware);

  // Add rate limiting info endpoint
  fastify.get('/rate-limit/info', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const quotaInfo = await quotaService.getUserQuotaInfo(
      user.id,
      user.plan as keyof typeof QUOTA_PLANS
    );

    return {
      rateLimits: {
        ip: RATE_LIMIT_CONFIGS.ip,
        user: RATE_LIMIT_CONFIGS.user,
        apiKey: RATE_LIMIT_CONFIGS.api_key
      },
      quotas: quotaInfo
    };
  });

  // Add admin endpoint to reset user rate limits
  fastify.post('/admin/rate-limit/reset/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    
    // Check if user has admin privileges (implement your own auth check)
    if (!request.user || request.user.plan !== 'enterprise') {
      return reply.code(403).send({ error: 'Admin privileges required' });
    }

    await rateLimitingService.resetRateLimit(userId, 'user');
    await quotaService.resetUserQuota(userId);

    return { message: 'Rate limits reset successfully', userId };
  });

  // Add admin endpoint for rate limiting statistics
  fastify.get('/admin/rate-limit/stats', async (request, reply) => {
    // Check if user has admin privileges
    if (!request.user || request.user.plan !== 'enterprise') {
      return reply.code(403).send({ error: 'Admin privileges required' });
    }

    // This would be implemented with the monitoring service
    return {
      message: 'Statistics endpoint - to be implemented with monitoring service',
      endpoints: [
        'GET /admin/rate-limit/stats/hour',
        'GET /admin/rate-limit/stats/day',
        'GET /admin/rate-limit/stats/week'
      ]
    };
  });
}

// Extension pour les types Fastify
declare module 'fastify' {
  export interface FastifyInstance {
    rateLimiting: RateLimitingService;
    quota: QuotaService;
    rateLimitMiddleware: RateLimitingMiddleware;
  }
}
