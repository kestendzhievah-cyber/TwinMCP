import Redis from 'ioredis';
import { RateLimitStats, QuotaUsage } from './types';
import { MONITORING_CONFIG } from './plans';

export class RateLimitingMonitor {
  constructor(private redis: Redis) {}

  async getRateLimitStats(timeRange: 'hour' | 'day' | 'week'): Promise<RateLimitStats> {
    const now = Date.now();
    let startTime: number;

    switch (timeRange) {
      case 'hour':
        startTime = now - 3600000;
        break;
      case 'day':
        startTime = now - 86400000;
        break;
      case 'week':
        startTime = now - 604800000;
        break;
    }

    // Get stats from Redis
    const statsKey = `rate-limit:stats:${timeRange}`;
    const stats = await this.redis.hgetall(statsKey);
    
    // Calculate blocked rate
    const totalRequests = parseInt(stats.totalRequests || '0');
    const blockedRequests = parseInt(stats.blockedRequests || '0');
    const blockRate = totalRequests > 0 ? blockedRequests / totalRequests : 0;

    return {
      totalRequests,
      blockedRequests,
      topUsers: await this.getTopUsers(startTime),
      topIPs: await this.getTopIPs(startTime),
      averageRPS: parseFloat(stats.averageRPS || '0')
    };
  }

  async getQuotaUsage(): Promise<QuotaUsage[]> {
    const quotaUsage: QuotaUsage[] = [];
    
    // Get all user quota keys
    const userKeys = await this.redis.keys('quota:daily:*');
    const users = new Set<string>();

    // Extract unique user IDs
    for (const key of userKeys) {
      const match = key.match(/quota:daily:([^:]+):/);
      if (match) {
        users.add(match[1]);
      }
    }

    // Get quota info for each user
    for (const userId of users) {
      const usage = await this.getUserQuotaUsage(userId);
      if (usage) {
        quotaUsage.push(usage);
      }
    }

    return quotaUsage.sort((a, b) => b.percentage - a.percentage);
  }

  async recordRequest(identifier: string, keyGenerator: string, blocked: boolean): Promise<void> {
    const now = Date.now();
    const hourKey = `requests:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `requests:day:${Math.floor(now / 86400000)}`;
    const weekKey = `requests:week:${Math.floor(now / 604800000)}`;

    const identifierKey = `${keyGenerator}:${identifier}`;

    // Record request counts
    await Promise.all([
      this.redis.hincrby(hourKey, 'total', 1),
      this.redis.hincrby(dayKey, 'total', 1),
      this.redis.hincrby(weekKey, 'total', 1),
      this.redis.hincrby(hourKey, identifierKey, 1),
      this.redis.hincrby(dayKey, identifierKey, 1),
      this.redis.hincrby(weekKey, identifierKey, 1)
    ]);

    // Record blocked requests
    if (blocked) {
      await Promise.all([
        this.redis.hincrby(hourKey, 'blocked', 1),
        this.redis.hincrby(dayKey, 'blocked', 1),
        this.redis.hincrby(weekKey, 'blocked', 1)
      ]);
    }

    // Set expiration
    await Promise.all([
      this.redis.expire(hourKey, MONITORING_CONFIG.statsRetention.hour),
      this.redis.expire(dayKey, MONITORING_CONFIG.statsRetention.day),
      this.redis.expire(weekKey, MONITORING_CONFIG.statsRetention.week)
    ]);
  }

  async recordLatency(identifier: string, latency: number): Promise<void> {
    const now = Date.now();
    const minuteKey = `latency:${Math.floor(now / 60000)}`;
    
    // Store latency for moving average calculation
    await this.redis.lpush(minuteKey, latency.toString());
    await this.redis.ltrim(minuteKey, 0, 999); // Keep last 1000 measurements
    await this.redis.expire(minuteKey, 3600); // Keep for 1 hour
  }

  async getAverageLatency(timeWindow: number = 300000): Promise<number> {
    const now = Date.now();
    const keys = [];
    
    // Get latency keys for the time window
    for (let time = now - timeWindow; time <= now; time += 60000) {
      keys.push(`latency:${Math.floor(time / 60000)}`);
    }

    if (keys.length === 0) return 0;

    // Get all latency measurements
    const values = await this.redis.mget(...keys);
    let total = 0;
    let count = 0;

    for (const key of values) {
      if (key) {
        const latencies = await this.redis.lrange(key, 0, -1);
        for (const latency of latencies) {
          total += parseFloat(latency);
          count++;
        }
      }
    }

    return count > 0 ? total / count : 0;
  }

  async getAlertStatus(): Promise<{
    blockRateAlert: boolean;
    latencyAlert: boolean;
    quotaUsageAlert: boolean;
    details: any;
  }> {
    const stats = await this.getRateLimitStats('hour');
    const averageLatency = await this.getAverageLatency();
    const quotaUsage = await this.getQuotaUsage();

    const totalRequests = stats.totalRequests;
    const blockRate = totalRequests > 0 ? stats.blockedRequests / totalRequests : 0;
    
    const highQuotaUsers = quotaUsage.filter(user => user.percentage > MONITORING_CONFIG.alertThresholds.quotaUsage);

    return {
      blockRateAlert: blockRate > MONITORING_CONFIG.alertThresholds.blockRate,
      latencyAlert: averageLatency > MONITORING_CONFIG.alertThresholds.latency,
      quotaUsageAlert: highQuotaUsers.length > 0,
      details: {
        blockRate,
        averageLatency,
        highQuotaUsers: highQuotaUsers.length,
        thresholds: MONITORING_CONFIG.alertThresholds
      }
    };
  }

  private async getTopUsers(startTime: number): Promise<Array<{ userId: string; requests: number }>> {
    const dayKey = `requests:day:${Math.floor(startTime / 86400000)}`;
    const userKeys = await this.redis.hkeys(dayKey);
    
    const userRequests = [];
    for (const key of userKeys) {
      if (key.startsWith('user:')) {
        const userId = key.replace('user:', '');
        const requests = parseInt(await this.redis.hget(dayKey, key) || '0');
        userRequests.push({ userId, requests });
      }
    }

    return userRequests
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  private async getTopIPs(startTime: number): Promise<Array<{ ip: string; requests: number }>> {
    const dayKey = `requests:day:${Math.floor(startTime / 86400000)}`;
    const ipKeys = await this.redis.hkeys(dayKey);
    
    const ipRequests = [];
    for (const key of ipKeys) {
      if (key.startsWith('ip:')) {
        const ip = key.replace('ip:', '');
        const requests = parseInt(await this.redis.hget(dayKey, key) || '0');
        ipRequests.push({ ip, requests });
      }
    }

    return ipRequests
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  private async getUserQuotaUsage(userId: string): Promise<QuotaUsage | null> {
    const now = new Date();
    const dailyKey = `quota:daily:${userId}:${now.toISOString().split('T')[0]}`;
    const monthlyKey = `quota:monthly:${userId}:${now.toISOString().slice(0, 7)}`;

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.redis.get(dailyKey),
      this.redis.get(monthlyKey)
    ]);

    if (!dailyUsed && !monthlyUsed) return null;

    // Get user plan (this would typically come from a database)
    const planKey = `user:plan:${userId}`;
    const plan = await this.redis.get(planKey) || 'free';

    // Get quotas for the plan
    const quotas = {
      free: { daily: 100, monthly: 3000 },
      premium: { daily: 1000, monthly: 30000 },
      enterprise: { daily: 10000, monthly: 300000 }
    }[plan] || { daily: 100, monthly: 3000 };

    const daily = parseInt(dailyUsed || '0');
    const monthly = parseInt(monthlyUsed || '0');
    const percentage = Math.max((daily / quotas.daily) * 100, (monthly / quotas.monthly) * 100);

    return {
      userId,
      plan,
      dailyUsed: daily,
      dailyLimit: quotas.daily,
      monthlyUsed: monthly,
      monthlyLimit: quotas.monthly,
      percentage
    };
  }

  async cleanup(): Promise<void> {
    // Clean up old monitoring data
    const now = Date.now();
    const patterns = [
      `requests:hour:${Math.floor((now - 7200000) / 3600000)}`, // 2 hours ago
      `latency:${Math.floor((now - 7200000) / 60000)}` // 2 hours ago
    ];

    for (const pattern of patterns) {
      await this.redis.del(pattern);
    }
  }
}
