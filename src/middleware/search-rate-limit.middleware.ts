import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

export class SearchRateLimitMiddleware {
  constructor(private redis: Redis) {}

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:search:${request.ip}`;
    const limit = (request as any).user ? 1000 : 100; // Authentifié vs anonyme
    const window = 60; // 1 minute

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, limit - current));
    reply.header('X-RateLimit-Reset', new Date(Date.now() + window * 1000).toISOString());

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many search requests',
        retryAfter: window
      });
    }
  };

  autocomplete = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:autocomplete:${request.ip}`;
    const limit = (request as any).user ? 500 : 50;
    const window = 60;

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many autocomplete requests'
      });
    }
  };

  libraryDetail = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:detail:${request.ip}`;
    const limit = (request as any).user ? 2000 : 200;
    const window = 60;

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many detail requests'
      });
    }
  };

  suggestions = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:suggestions:${(request as any).user?.id || request.ip}`;
    const limit = 100;
    const window = 300; // 5 minutes

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many suggestion requests'
      });
    }
  };

  export = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:export:${(request as any).user?.id}`;
    const limit = 10;
    const window = 3600; // 1 heure

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Export limit exceeded',
        retryAfter: window
      });
    }
  };
}
