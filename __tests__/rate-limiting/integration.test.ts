import { FastifyInstance } from 'fastify';
import { setupRateLimiting } from '../../src/lib/rate-limiting/integration';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('Rate Limiting Integration', () => {
  let app: FastifyInstance;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedis = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      hmget: jest.fn().mockResolvedValue(['10', '0']),
      hmset: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('0'),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      scard: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      hkeys: jest.fn().mockResolvedValue([]),
      hget: jest.fn().mockResolvedValue('0'),
      hincrby: jest.fn().mockResolvedValue(1),
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
      lrange: jest.fn().mockResolvedValue([]),
      mget: jest.fn().mockResolvedValue([])
    } as any;

    MockRedis.mockImplementation(() => mockRedis);

    // Create Fastify instance
    const { fastify } = await import('fastify');
    app = fastify({ logger: false });

    // Setup rate limiting
    await setupRateLimiting(app, mockRedis as any);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  describe('Rate limiting endpoints', () => {
    it('should provide rate limit info for authenticated users', async () => {
      // Mock authenticated user
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'test-user', plan: 'free' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('rateLimits');
      expect(payload).toHaveProperty('quotas');
      expect(payload.rateLimits.ip).toBeDefined();
      expect(payload.quotas.plan).toBe('free');
    });

    it('should require authentication for rate limit info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow admin to reset user rate limits', async () => {
      // Mock admin user
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'admin-user', plan: 'enterprise' };
      });

      const response = await app.inject({
        method: 'POST',
        url: '/admin/rate-limit/reset/test-user'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('Rate limits reset successfully');
      expect(payload.userId).toBe('test-user');
    });

    it('should deny non-admin users access to reset endpoint', async () => {
      // Mock regular user
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'regular-user', plan: 'free' };
      });

      const response = await app.inject({
        method: 'POST',
        url: '/admin/rate-limit/reset/test-user'
      });

      expect(response.statusCode).toBe(403);
    });

    it('should provide admin statistics endpoint', async () => {
      // Mock admin user
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'admin-user', plan: 'enterprise' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/rate-limit/stats'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toContain('Statistics endpoint');
    });
  });

  describe('Rate limiting behavior', () => {
    it('should apply IP rate limiting to all requests', async () => {
      mockRedis.zcard.mockResolvedValue(5); // Under limit

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      // Should have rate limit headers even for unauthenticated requests
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
    });

    it('should block requests exceeding IP rate limit', async () => {
      mockRedis.zcard.mockResolvedValue(100); // Exceeds limit
      mockRedis.zrange.mockResolvedValue(['1234567890']);

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBe(429);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Too Many Requests');
    });

    it('should track user rate limits for authenticated requests', async () => {
      // Mock authenticated user
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'test-user', plan: 'free' };
      });

      mockRedis.zcard.mockResolvedValue(5); // Under limit

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBe(200);
      // Should have called rate limiting for user
      expect(mockRedis.zcard).toHaveBeenCalled();
    });

    it('should enforce quota limits', async () => {
      // Mock authenticated user with exceeded quota
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'test-user', plan: 'free' };
      });

      mockRedis.get.mockResolvedValue('100'); // Daily quota exceeded

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBe(402);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Payment Required');
      expect(payload.message).toBe('Quota exceeded');
    });
  });

  describe('Headers and responses', () => {
    it('should include rate limit headers in responses', async () => {
      mockRedis.zcard.mockResolvedValue(5);

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should include retry-after header when rate limited', async () => {
      mockRedis.zcard.mockResolvedValue(100); // Exceeds limit
      mockRedis.zrange.mockResolvedValue(['1234567890']);

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers).toHaveProperty('x-ratelimit-retry-after');
    });

    it('should include quota headers for authenticated users', async () => {
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: 'test-user', plan: 'premium' };
      });

      mockRedis.get.mockResolvedValue('50');
      mockRedis.scard.mockResolvedValue(2);

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.headers).toHaveProperty('x-quota-daily-limit');
      expect(response.headers).toHaveProperty('x-quota-daily-used');
      expect(response.headers).toHaveProperty('x-quota-monthly-limit');
      expect(response.headers).toHaveProperty('x-quota-concurrent-used');
    });
  });

  describe('Error handling', () => {
    it('should handle Redis errors gracefully', async () => {
      mockRedis.zcard.mockRejectedValue(new Error('Redis connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      // Should still respond, possibly with error logging
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should handle malformed user data', async () => {
      app.addHook('preHandler', async (request, reply) => {
        (request as any).user = { id: null, plan: 'invalid' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/rate-limit/info'
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});
