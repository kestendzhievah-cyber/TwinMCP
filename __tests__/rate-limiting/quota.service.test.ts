import { QuotaService } from '../../src/lib/rate-limiting/quota.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('QuotaService', () => {
  let service: QuotaService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue('0'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      scard: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([])
    } as any;

    MockRedis.mockImplementation(() => mockRedis);
    service = new QuotaService(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUserQuota', () => {
    it('should allow requests within quota limits', async () => {
      mockRedis.get.mockResolvedValue('50'); // 50 requests used out of 100

      const result = await service.checkUserQuota('user1', 'free');
      
      expect(result.allowed).toBe(true);
      expect(result.quotas.daily).toBe(100);
      expect(result.usage.daily).toBe(50);
    });

    it('should block when daily quota exceeded', async () => {
      mockRedis.get.mockResolvedValue('100'); // 100 requests used

      const result = await service.checkUserQuota('user1', 'free');
      
      expect(result.allowed).toBe(false);
      expect(result.headers['X-Quota-Exceeded']).toBe('daily');
    });

    it('should block when monthly quota exceeded', async () => {
      mockRedis.get
        .mockResolvedValueOnce('50') // daily
        .mockResolvedValueOnce('3000'); // monthly exceeded

      const result = await service.checkUserQuota('user1', 'free');
      
      expect(result.allowed).toBe(false);
      expect(result.headers['X-Quota-Exceeded']).toBe('monthly');
    });

    it('should block when concurrent limit exceeded', async () => {
      mockRedis.get.mockResolvedValue('50'); // daily usage
      mockRedis.scard.mockResolvedValue(3); // 3 concurrent requests

      const result = await service.checkUserQuota('user1', 'free');
      
      expect(result.allowed).toBe(false);
      expect(result.headers['X-Quota-Exceeded']).toBe('concurrent');
    });

    it('should use correct quotas for different plans', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.scard.mockResolvedValue(0);

      const premiumResult = await service.checkUserQuota('user1', 'premium');
      expect(premiumResult.quotas.daily).toBe(1000);
      expect(premiumResult.quotas.monthly).toBe(30000);

      const enterpriseResult = await service.checkUserQuota('user1', 'enterprise');
      expect(enterpriseResult.quotas.daily).toBe(10000);
      expect(enterpriseResult.quotas.monthly).toBe(300000);
    });
  });

  describe('incrementUsage', () => {
    it('should increment daily and monthly counters', async () => {
      await service.incrementUsage('user1');
      
      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/quota:daily:user1:\d{4}-\d{2}-\d{2}/)
      );
      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/quota:monthly:user1:\d{4}-\d{2}/)
      );
      expect(mockRedis.expire).toHaveBeenCalledTimes(2);
    });
  });

  describe('startRequest and endRequest', () => {
    it('should track concurrent requests', async () => {
      const requestId = await service.startRequest('user1');
      
      expect(requestId).toMatch(/^user1-\d+-\d+\.\d+$/);
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'concurrent:user1',
        requestId
      );
    });

    it('should remove request from concurrent tracking', async () => {
      await service.endRequest('user1', 'request-123');
      
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'concurrent:user1',
        'request-123'
      );
    });
  });

  describe('resetUserQuota', () => {
    it('should delete all quota keys for user', async () => {
      mockRedis.keys
        .mockResolvedValueOnce(['quota:daily:user1:2023-01-01'])
        .mockResolvedValueOnce(['quota:monthly:user1:2023-01'])
        .mockResolvedValueOnce(['concurrent:user1']);

      await service.resetUserQuota('user1');
      
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('getUserQuotaInfo', () => {
    it('should return comprehensive quota information', async () => {
      mockRedis.get.mockResolvedValue('50');
      mockRedis.scard.mockResolvedValue(2);

      const info = await service.getUserQuotaInfo('user1', 'premium');
      
      expect(info.plan).toBe('premium');
      expect(info.quotas.daily).toBe(1000);
      expect(info.usage.daily).toBe(50);
      expect(info.usage.concurrent).toBe(2);
      expect(info.resetTimes.daily).toBeInstanceOf(Date);
      expect(info.resetTimes.monthly).toBeInstanceOf(Date);
    });
  });

  describe('headers', () => {
    it('should include all quota headers', async () => {
      mockRedis.get.mockResolvedValue('50');
      mockRedis.scard.mockResolvedValue(2);

      const result = await service.checkUserQuota('user1', 'premium');
      
      expect(result.headers).toHaveProperty('X-Quota-Daily-Limit', '1000');
      expect(result.headers).toHaveProperty('X-Quota-Daily-Used', '50');
      expect(result.headers).toHaveProperty('X-Quota-Monthly-Limit', '30000');
      expect(result.headers).toHaveProperty('X-Quota-Concurrent-Limit', '10');
      expect(result.headers).toHaveProperty('X-Quota-Concurrent-Used', '2');
    });

    it('should include reset time when quota exceeded', async () => {
      mockRedis.get.mockResolvedValue('100'); // daily quota exceeded

      const result = await service.checkUserQuota('user1', 'free');
      
      expect(result.headers).toHaveProperty('X-Quota-Daily-Reset');
      expect(result.headers['X-Quota-Daily-Reset']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('date calculations', () => {
    it('should calculate correct daily reset time', () => {
      const now = new Date('2023-01-15T10:30:00Z');
      const service = new QuotaService(mockRedis);
      
      // Access private method through prototype
      const nextReset = (service as any).getNextDailyReset();
      
      expect(nextReset.toISOString()).toBe('2023-01-16T00:00:00.000Z');
    });

    it('should calculate correct monthly reset time', () => {
      const now = new Date('2023-01-15T10:30:00Z');
      const service = new QuotaService(mockRedis);
      
      // Access private method through prototype
      const nextReset = (service as any).getNextMonthlyReset();
      
      expect(nextReset.toISOString()).toBe('2023-02-01T00:00:00.000Z');
    });
  });
});
