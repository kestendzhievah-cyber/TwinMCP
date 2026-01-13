import Redis from 'ioredis';
import { QuotaResult } from './types';
import { QUOTA_PLANS } from './plans';

export class QuotaService {
  constructor(private redis: Redis) {}

  async checkUserQuota(userId: string, plan: keyof typeof QUOTA_PLANS): Promise<QuotaResult> {
    const quotas = QUOTA_PLANS[plan];
    
    // Get current usage
    const usage = await this.getUserUsage(userId);
    const concurrent = await this.getConcurrentRequests(userId);
    const usageWithConcurrent = { ...usage, concurrent };
    
    // Check daily quota
    if (usage.daily >= quotas.daily) {
      const resetTime = this.getNextDailyReset();
      return {
        allowed: false,
        quotas,
        usage: usageWithConcurrent,
        headers: {
          'X-Quota-Daily-Limit': quotas.daily.toString(),
          'X-Quota-Daily-Used': usage.daily.toString(),
          'X-Quota-Daily-Reset': resetTime.toISOString(),
          'X-Quota-Exceeded': 'daily'
        }
      };
    }

    // Check monthly quota
    if (usage.monthly >= quotas.monthly) {
      const resetTime = this.getNextMonthlyReset();
      return {
        allowed: false,
        quotas,
        usage: usageWithConcurrent,
        headers: {
          'X-Quota-Monthly-Limit': quotas.monthly.toString(),
          'X-Quota-Monthly-Used': usage.monthly.toString(),
          'X-Quota-Monthly-Reset': resetTime.toISOString(),
          'X-Quota-Exceeded': 'monthly'
        }
      };
    }

    // Check concurrent requests
    const currentConcurrent = await this.getConcurrentRequests(userId);
    if (currentConcurrent >= quotas.concurrent) {
      return {
        allowed: false,
        quotas,
        usage: usageWithConcurrent,
        headers: {
          'X-Quota-Concurrent-Limit': quotas.concurrent.toString(),
          'X-Quota-Concurrent-Used': currentConcurrent.toString(),
          'X-Quota-Exceeded': 'concurrent'
        }
      };
    }

    return {
      allowed: true,
      quotas,
      usage: usageWithConcurrent,
      headers: {
        'X-Quota-Daily-Limit': quotas.daily.toString(),
        'X-Quota-Daily-Used': usage.daily.toString(),
        'X-Quota-Monthly-Limit': quotas.monthly.toString(),
        'X-Quota-Monthly-Used': usage.monthly.toString(),
        'X-Quota-Concurrent-Limit': quotas.concurrent.toString(),
        'X-Quota-Concurrent-Used': currentConcurrent.toString()
      }
    };
  }

  async incrementUsage(userId: string): Promise<void> {
    const now = new Date();
    const dailyKey = `quota:daily:${userId}:${this.getDateKey(now)}`;
    const monthlyKey = `quota:monthly:${userId}:${this.getMonthKey(now)}`;

    await Promise.all([
      this.redis.incr(dailyKey),
      this.redis.incr(monthlyKey),
      this.redis.expire(dailyKey, 86400), // 24 hours
      this.redis.expire(monthlyKey, 2592000) // 30 days
    ]);
  }

  async startRequest(userId: string): Promise<string> {
    const requestId = `${userId}-${Date.now()}-${Math.random()}`;
    await this.redis.sadd(`concurrent:${userId}`, requestId);
    return requestId;
  }

  async endRequest(userId: string, requestId: string): Promise<void> {
    await this.redis.srem(`concurrent:${userId}`, requestId);
  }

  async resetUserQuota(userId: string): Promise<void> {
    const patterns = [
      `quota:daily:${userId}:*`,
      `quota:monthly:${userId}:*`,
      `concurrent:${userId}`
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  async getUserQuotaInfo(userId: string, plan: keyof typeof QUOTA_PLANS): Promise<{
    plan: string;
    quotas: typeof QUOTA_PLANS[keyof typeof QUOTA_PLANS];
    usage: {
      daily: number;
      monthly: number;
      concurrent: number;
    };
    resetTimes: {
      daily: Date;
      monthly: Date;
    };
  }> {
    const quotas = QUOTA_PLANS[plan];
    const usage = await this.getUserUsage(userId);
    const concurrent = await this.getConcurrentRequests(userId);

    return {
      plan,
      quotas,
      usage: { ...usage, concurrent },
      resetTimes: {
        daily: this.getNextDailyReset(),
        monthly: this.getNextMonthlyReset()
      }
    };
  }

  private async getUserUsage(userId: string): Promise<{
    daily: number;
    monthly: number;
  }> {
    const now = new Date();
    const dailyKey = `quota:daily:${userId}:${this.getDateKey(now)}`;
    const monthlyKey = `quota:monthly:${userId}:${this.getMonthKey(now)}`;

    const [daily, monthly] = await Promise.all([
      this.redis.get(dailyKey),
      this.redis.get(monthlyKey)
    ]);

    return {
      daily: parseInt(daily || '0'),
      monthly: parseInt(monthly || '0')
    };
  }

  private async getConcurrentRequests(userId: string): Promise<number> {
    return this.redis.scard(`concurrent:${userId}`);
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getMonthKey(date: Date): string {
    const dateStr = date.toISOString();
    return dateStr.slice(0, 7);
  }

  private getNextDailyReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getNextMonthlyReset(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }
}
