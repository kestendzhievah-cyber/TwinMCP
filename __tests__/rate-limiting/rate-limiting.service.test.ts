import { RateLimitingService } from '../../src/lib/rate-limiting/rate-limiting.service';
import { RateLimitConfig } from '../../src/lib/rate-limiting/types';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('RateLimitingService', () => {
  let service: RateLimitingService;
  let mockRedis: jest.Mocked<Redis>;

  const mockConfig: RateLimitConfig = {
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: 'test',
    strategy: 'sliding-window'
  };

  beforeEach(() => {
    mockRedis = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      hmget: jest.fn().mockResolvedValue(['10', '0']),
      hmset: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1)
    } as any;

    MockRedis.mockImplementation(() => mockRedis);
    service = new RateLimitingService(mockRedis, mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      mockRedis.zcard.mockResolvedValue(5);

      const result = await service.checkRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(10);
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('should block requests exceeding limit', async () => {
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zrange.mockResolvedValue(['1234567890']);

      const result = await service.checkRateLimit('user1');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('should use custom config when provided', async () => {
      const customConfig = { maxRequests: 5 };
      mockRedis.zcard.mockResolvedValue(3);

      const result = await service.checkRateLimit('user1', customConfig);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.limit).toBe(5);
    });
  });

  describe('sliding window strategy', () => {
    it('should remove expired entries', async () => {
      await service.checkRateLimit('user1');
      
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        expect.any(String),
        0,
        expect.any(Number)
      );
    });

    it('should set expiration on key', async () => {
      await service.checkRateLimit('user1');
      
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.any(String),
        60
      );
    });
  });

  describe('token bucket strategy', () => {
    beforeEach(() => {
      service = new RateLimitingService(mockRedis, {
        ...mockConfig,
        strategy: 'token-bucket'
      });
    });

    it('should consume tokens correctly', async () => {
      mockRedis.hmget.mockResolvedValue(['5', Date.now().toString()]);

      const result = await service.checkRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(mockRedis.hmset).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tokens: 4,
          lastRefill: expect.any(Number)
        })
      );
    });

    it('should refill tokens based on time elapsed', async () => {
      const pastTime = Date.now() - 30000; // 30 seconds ago
      mockRedis.hmget.mockResolvedValue(['5', pastTime.toString()]);

      const result = await service.checkRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(mockRedis.hmset).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          lastRefill: expect.any(Number)
        })
      );
    });
  });

  describe('fixed window strategy', () => {
    beforeEach(() => {
      service = new RateLimitingService(mockRedis, {
        ...mockConfig,
        strategy: 'fixed-window'
      });
    });

    it('should use windowed keys', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.checkRateLimit('user1');
      
      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/rate-limit:test:user1:\d+/)
      );
    });

    it('should set expiration on first request', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.checkRateLimit('user1');
      
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('resetRateLimit', () => {
    it('should delete all rate limit keys for user', async () => {
      mockRedis.keys.mockResolvedValue([
        'rate-limit:test:user1',
        'rate-limit:test:user1:123456'
      ]);

      await service.resetRateLimit('user1', 'test');
      
      expect(mockRedis.keys).toHaveBeenCalledWith('rate-limit:test:user1*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'rate-limit:test:user1',
        'rate-limit:test:user1:123456'
      );
    });
  });

  describe('getCurrentUsage', () => {
    it('should return current request count', async () => {
      mockRedis.zcard.mockResolvedValue(7);

      const usage = await service.getCurrentUsage('user1', 'test', 60000);
      
      expect(usage).toBe(7);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });
  });

  describe('headers', () => {
    it('should include all required headers', async () => {
      mockRedis.zcard.mockResolvedValue(5);

      const result = await service.checkRateLimit('user1');
      
      expect(result.headers).toHaveProperty('X-RateLimit-Limit', '10');
      expect(result.headers).toHaveProperty('X-RateLimit-Remaining', '4');
      expect(result.headers).toHaveProperty('X-RateLimit-Reset');
    });

    it('should include retry-after header when blocked', async () => {
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zrange.mockResolvedValue(['1234567890']);

      const result = await service.checkRateLimit('user1');
      
      expect(result.headers).toHaveProperty('X-RateLimit-Retry-After');
    });
  });
});
