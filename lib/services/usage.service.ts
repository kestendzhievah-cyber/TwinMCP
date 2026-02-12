import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface UsageStats {
  apiKeyId: string;
  keyName: string;
  keyPrefix: string;
  tier: 'free' | 'pro' | 'enterprise';
  quotaDaily: number;
  usedToday: number;
  usedThisHour: number;
  usedThisMonth: number;
  remainingToday: number;
  successRate: number;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface DashboardStats {
  totalKeys: number;
  totalRequestsToday: number;
  totalRequestsMonth: number;
  averageSuccessRate: number;
  subscription: {
    plan: string;
    dailyLimit: number;
    monthlyLimit: number;
    usedToday: number;
    usedMonth: number;
  };
  keys: UsageStats[];
  recentActivity: {
    timestamp: Date;
    toolName: string;
    success: boolean;
    responseTimeMs: number;
  }[];
}

export const PLAN_LIMITS = {
  free: {
    dailyLimit: 200,
    monthlyLimit: 6000,
    maxKeys: 2,
    rateLimit: 20 // per minute
  },
  pro: {
    dailyLimit: 10000,
    monthlyLimit: 300000,
    maxKeys: 10,
    rateLimit: 200 // per minute
  },
  enterprise: {
    dailyLimit: 100000,
    monthlyLimit: 3000000,
    maxKeys: 100,
    rateLimit: 2000 // per minute
  }
};

export class UsageService {
  private prisma: PrismaClient;
  private redis: Redis | null;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.prisma = prisma;
    this.redis = redis || null;
  }

  // Get daily usage key for Redis
  private getDailyKey(apiKeyId: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `usage:daily:${apiKeyId}:${today}`;
  }

  // Get hourly usage key for Redis
  private getHourlyKey(apiKeyId: string): string {
    const now = new Date();
    const hour = now.toISOString().slice(0, 13);
    return `usage:hourly:${apiKeyId}:${hour}`;
  }

  // Get monthly usage key for Redis
  private getMonthlyKey(apiKeyId: string): string {
    const month = new Date().toISOString().slice(0, 7);
    return `usage:monthly:${apiKeyId}:${month}`;
  }

  // Increment usage count (called on each API request)
  async trackUsage(
    apiKeyId: string,
    toolName: string,
    success: boolean,
    responseTimeMs: number,
    userId?: string,
    libraryId?: string,
    query?: string,
    tokensReturned?: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    try {
      // Get API key to check limits
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { id: apiKeyId }
      });

      if (!apiKey || !apiKey.isActive) {
        return { allowed: false, remaining: 0 };
      }

      const tier = apiKey.tier as 'free' | 'pro' | 'enterprise';
      const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

      let currentDaily = 0;
      let currentHourly = 0;

      if (this.redis) {
        // Use Redis for real-time tracking
        const dailyKey = this.getDailyKey(apiKeyId);
        const hourlyKey = this.getHourlyKey(apiKeyId);
        const monthlyKey = this.getMonthlyKey(apiKeyId);

        // Increment counters
        const pipeline = this.redis.pipeline();
        pipeline.incr(dailyKey);
        pipeline.expire(dailyKey, 86400); // 24 hours
        pipeline.incr(hourlyKey);
        pipeline.expire(hourlyKey, 3600); // 1 hour
        pipeline.incr(monthlyKey);
        pipeline.expire(monthlyKey, 2678400); // 31 days
        
        const results = await pipeline.exec();
        currentDaily = (results?.[0]?.[1] as number) || 0;
        currentHourly = (results?.[2]?.[1] as number) || 0;
      } else {
        // Fallback to database counting
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dailyCount = await this.prisma.usageLog.count({
          where: {
            apiKeyId,
            createdAt: { gte: today }
          }
        });
        currentDaily = dailyCount + 1;

        const hourAgo = new Date(Date.now() - 3600000);
        const hourlyCount = await this.prisma.usageLog.count({
          where: {
            apiKeyId,
            createdAt: { gte: hourAgo }
          }
        });
        currentHourly = hourlyCount + 1;
      }

      // Check if over limit
      if (currentDaily > limits.dailyLimit) {
        return { allowed: false, remaining: 0 };
      }

      // Log usage to database
      await this.prisma.usageLog.create({
        data: {
          apiKeyId,
          userId,
          libraryId,
          toolName,
          query,
          tokensReturned,
          responseTimeMs,
          success,
          errorMessage: success ? null : 'Request failed'
        }
      });

      // Update API key last used timestamp and daily counter
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          lastUsedAt: new Date(),
          usedDaily: currentDaily,
          usedMonthly: { increment: 1 }
        }
      });

      return {
        allowed: true,
        remaining: limits.dailyLimit - currentDaily
      };
    } catch (error) {
      console.error('Error tracking usage:', error);
      return { allowed: true, remaining: 0 };
    }
  }

  // Get usage stats for a single API key
  async getKeyUsageStats(apiKeyId: string): Promise<UsageStats | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId }
    });

    if (!apiKey) return null;

    const tier = (apiKey.tier || 'free') as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

    let usedToday = 0;
    let usedThisHour = 0;
    let usedThisMonth = 0;

    if (this.redis) {
      const dailyKey = this.getDailyKey(apiKeyId);
      const hourlyKey = this.getHourlyKey(apiKeyId);
      const monthlyKey = this.getMonthlyKey(apiKeyId);

      const [daily, hourly, monthly] = await Promise.all([
        this.redis.get(dailyKey),
        this.redis.get(hourlyKey),
        this.redis.get(monthlyKey)
      ]);

      usedToday = parseInt(daily || '0', 10);
      usedThisHour = parseInt(hourly || '0', 10);
      usedThisMonth = parseInt(monthly || '0', 10);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const hourAgo = new Date(Date.now() - 3600000);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [daily, hourly, monthly] = await Promise.all([
        this.prisma.usageLog.count({
          where: { apiKeyId, createdAt: { gte: today } }
        }),
        this.prisma.usageLog.count({
          where: { apiKeyId, createdAt: { gte: hourAgo } }
        }),
        this.prisma.usageLog.count({
          where: { apiKeyId, createdAt: { gte: monthStart } }
        })
      ]);

      usedToday = daily;
      usedThisHour = hourly;
      usedThisMonth = monthly;
    }

    // Calculate success rate
    const recentLogs = await this.prisma.usageLog.findMany({
      where: { apiKeyId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const successCount = recentLogs.filter((log: typeof recentLogs[number]) => log.success).length;
    const successRate = recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 100;

    return {
      apiKeyId: apiKey.id,
      keyName: apiKey.name || 'Sans nom',
      keyPrefix: apiKey.keyPrefix,
      tier,
      quotaDaily: limits.dailyLimit,
      usedToday,
      usedThisHour,
      usedThisMonth,
      remainingToday: Math.max(0, limits.dailyLimit - usedToday),
      successRate: Math.round(successRate * 10) / 10,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt
    };
  }

  // Get dashboard stats for a user
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    // Get user's subscription/plan
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });

    const subscription = userProfile?.subscriptions?.[0];
    const plan = subscription?.plan || 'free';
    const tier = plan as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

    // Get all user's API keys
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // Get usage stats for each key
    const keysWithStats = await Promise.all(
      apiKeys.map((key: typeof apiKeys[number]) => this.getKeyUsageStats(key.id))
    );

    const validKeys = keysWithStats.filter((k): k is UsageStats => k !== null);

    // Calculate totals
    const totalRequestsToday = validKeys.reduce((sum, k) => sum + k.usedToday, 0);
    const totalRequestsMonth = validKeys.reduce((sum, k) => sum + k.usedThisMonth, 0);
    const avgSuccessRate = validKeys.length > 0
      ? validKeys.reduce((sum, k) => sum + k.successRate, 0) / validKeys.length
      : 100;

    // Get recent activity
    const recentLogs = await this.prisma.usageLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        createdAt: true,
        toolName: true,
        success: true,
        responseTimeMs: true
      }
    });

    return {
      totalKeys: apiKeys.length,
      totalRequestsToday,
      totalRequestsMonth,
      averageSuccessRate: Math.round(avgSuccessRate * 10) / 10,
      subscription: {
        plan: tier,
        dailyLimit: limits.dailyLimit,
        monthlyLimit: limits.monthlyLimit,
        usedToday: totalRequestsToday,
        usedMonth: totalRequestsMonth
      },
      keys: validKeys,
      recentActivity: recentLogs.map((log: typeof recentLogs[number]) => ({
        timestamp: log.createdAt,
        toolName: log.toolName,
        success: log.success,
        responseTimeMs: log.responseTimeMs || 0
      }))
    };
  }

  // Reset daily counters (should be called by a cron job at midnight)
  async resetDailyCounters(): Promise<void> {
    await this.prisma.apiKey.updateMany({
      data: { usedDaily: 0 }
    });

    if (this.redis) {
      // Redis keys will expire automatically
    }
  }

  // Reset monthly counters (should be called by a cron job on 1st of month)
  async resetMonthlyCounters(): Promise<void> {
    await this.prisma.apiKey.updateMany({
      data: { usedMonthly: 0 }
    });
  }
}
