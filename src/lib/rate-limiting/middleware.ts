import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitingService } from './rate-limiting.service';
import { QuotaService } from './quota.service';
import { RATE_LIMIT_CONFIGS, QUOTA_PLANS } from './plans';

export class RateLimitingMiddleware {
  constructor(
    private rateLimitingService: RateLimitingService,
    private quotaService: QuotaService
  ) {}

  ipRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip;
    const result = await this.rateLimitingService.checkRateLimit(
      ip,
      RATE_LIMIT_CONFIGS.ip
    );

    // Set headers
    Object.entries(result.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!result.allowed) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: result.retryAfter
      });
      return reply;
    }
  };

  userRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return;

    const result = await this.rateLimitingService.checkRateLimit(
      user.id,
      RATE_LIMIT_CONFIGS.user
    );

    Object.entries(result.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!result.allowed) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'User rate limit exceeded',
        retryAfter: result.retryAfter
      });
      return reply;
    }
  };

  apiKeyRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.apiKey;
    if (!apiKey) return;

    const result = await this.rateLimitingService.checkRateLimit(
      apiKey.id,
      RATE_LIMIT_CONFIGS.api_key
    );

    Object.entries(result.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!result.allowed) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'API key rate limit exceeded',
        retryAfter: result.retryAfter
      });
      return reply;
    }
  };

  quotaCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return;

    const quotaResult = await this.quotaService.checkUserQuota(
      user.id,
      user.plan as keyof typeof QUOTA_PLANS
    );

    Object.entries(quotaResult.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (!quotaResult.allowed) {
      reply.code(402).send({
        error: 'Payment Required',
        message: 'Quota exceeded',
        quotaType: quotaResult.headers['X-Quota-Exceeded']
      });
      return reply;
    }

    // Start tracking request
    const requestId = await this.quotaService.startRequest(user.id);
    request.requestId = requestId;

    // Increment usage
    await this.quotaService.incrementUsage(user.id);

    // Clean up on response
    reply.raw.on('finish', async () => {
      if (request.requestId) {
        await this.quotaService.endRequest(user.id, request.requestId);
      }
    });
  };

  // Combined middleware for authenticated requests
  authenticatedRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user || request.apiKey) {
      await this.userRateLimit(request, reply);
      if (reply.statusCode >= 400) return reply;

      await this.apiKeyRateLimit(request, reply);
      if (reply.statusCode >= 400) return reply;

      await this.quotaCheck(request, reply);
    }
  };

  // Custom rate limit middleware with config
  customRateLimit = (config: Partial<typeof RATE_LIMIT_CONFIGS[keyof typeof RATE_LIMIT_CONFIGS]>) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const identifier = request.user?.id || request.apiKey?.id || request.ip;
      if (!identifier) return;

      const result = await this.rateLimitingService.checkRateLimit(identifier, config);

      Object.entries(result.headers).forEach(([key, value]) => {
        reply.header(key, value);
      });

      if (!result.allowed) {
        reply.code(429).send({
          error: 'Too Many Requests',
          message: 'Custom rate limit exceeded',
          retryAfter: result.retryAfter
        });
        return reply;
      }
    };
  };
}
