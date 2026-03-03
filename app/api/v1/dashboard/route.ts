import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';

const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 3, rateLimit: 20 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10, rateLimit: 200 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100, rateLimit: 2000 },
};

// Get empty stats
function getEmptyStats() {
  return {
    totalKeys: 0,
    totalRequestsToday: 0,
    totalRequestsMonth: 0,
    averageSuccessRate: 100,
    subscription: {
      plan: 'free',
      dailyLimit: 200,
      monthlyLimit: 6000,
      usedToday: 0,
      usedMonth: 0,
    },
    keys: [],
    recentActivity: [],
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const auth = await validateAuth(request.headers.get('authorization'));

    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    // Try to get or create user
    let dbUser;
    try {
      dbUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { oauthId: userId }],
        },
      });

      if (!dbUser) {
        // Create default client if needed
        let defaultClient = await prisma.client.findFirst({
          where: { name: 'default' },
        });

        if (!defaultClient) {
          defaultClient = await prisma.client.create({
            data: { name: 'default', apiKeys: {} },
          });
        }

        // Create user
        dbUser = await prisma.user.create({
          data: {
            id: userId,
            email: auth.email || `user-${userId}@twinmcp.local`,
            oauthId: userId,
            oauthProvider: 'firebase',
            clientId: defaultClient.id,
          },
        });
      }
    } catch (dbError) {
      logger.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyStats(),
      });
    }

    // Get stats
    try {
      // Get user's plan
      let plan = 'free';
      try {
        const userProfile = await prisma.userProfile.findUnique({
          where: { userId: dbUser.id },
          include: { subscriptions: { where: { status: 'ACTIVE' } } },
        });
        plan = userProfile?.subscriptions?.[0]?.plan || 'free';
      } catch {
        // Default to free
      }

      const tier = plan as 'free' | 'pro' | 'enterprise';
      const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

      // Get API keys
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId: dbUser.id, isActive: true, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate date boundaries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hourAgo = new Date(Date.now() - 3600000);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Batch all key stats in 3 aggregate queries instead of N*4 queries (N+1 fix)
      const keyIds = apiKeys.map((k: (typeof apiKeys)[number]) => k.id);

      const dailyByKey = new Map<string, number>();
      const hourlyByKey = new Map<string, number>();
      const successByKey = new Map<string, number>();

      if (keyIds.length > 0) {
        try {
          const [dailyAgg, hourlyAgg, recentLogs] = await Promise.all([
            // Single query: daily counts grouped by apiKeyId
            prisma.usageLog.groupBy({
              by: ['apiKeyId'],
              where: { apiKeyId: { in: keyIds }, createdAt: { gte: today } },
              _count: true,
            }),
            // Single query: hourly counts grouped by apiKeyId
            prisma.usageLog.groupBy({
              by: ['apiKeyId'],
              where: { apiKeyId: { in: keyIds }, createdAt: { gte: hourAgo } },
              _count: true,
            }),
            // Single query: recent logs for success rate (limited)
            prisma.usageLog.findMany({
              where: { apiKeyId: { in: keyIds } },
              orderBy: { createdAt: 'desc' },
              take: keyIds.length * 50,
              select: { apiKeyId: true, success: true },
            }),
          ]);

          for (const row of dailyAgg) {
            if (row.apiKeyId) dailyByKey.set(row.apiKeyId, row._count);
          }
          for (const row of hourlyAgg) {
            if (row.apiKeyId) hourlyByKey.set(row.apiKeyId, row._count);
          }

          // Compute success rate per key from recent logs
          const logsByKey = new Map<string, { total: number; success: number }>();
          for (const log of recentLogs) {
            if (!log.apiKeyId) continue;
            const entry = logsByKey.get(log.apiKeyId) || { total: 0, success: 0 };
            entry.total++;
            if (log.success) entry.success++;
            logsByKey.set(log.apiKeyId, entry);
          }
          for (const [kid, stats] of logsByKey) {
            successByKey.set(
              kid,
              stats.total > 0 ? Math.round((stats.success / stats.total) * 1000) / 10 : 100
            );
          }
        } catch {
          // Keep empty maps (defaults to 0)
        }
      }

      const keysWithStats = apiKeys.map((key: (typeof apiKeys)[number]) => ({
        id: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name || 'Sans nom',
        tier: key.tier,
        quotaDaily: limits.dailyLimit,
        quotaHourly: limits.rateLimit,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() || null,
        usage: {
          requestsToday: dailyByKey.get(key.id) || 0,
          requestsThisHour: hourlyByKey.get(key.id) || 0,
          successRate: successByKey.get(key.id) ?? 100,
        },
      }));

      // Calculate totals
      const totalRequestsToday = keysWithStats.reduce(
        (sum, k) => sum + (k.usage?.requestsToday || 0),
        0
      );
      // Get actual monthly usage from DB
      let totalRequestsMonth = 0;
      try {
        totalRequestsMonth = await prisma.usageLog.count({
          where: { userId: dbUser.id, createdAt: { gte: monthStart } },
        });
      } catch {
        totalRequestsMonth = keysWithStats.reduce(
          (sum, k) => sum + (k.usage?.requestsToday || 0),
          0
        );
      }
      const avgSuccessRate =
        keysWithStats.length > 0
          ? keysWithStats.reduce((sum, k) => sum + (k.usage?.successRate || 100), 0) /
            keysWithStats.length
          : 100;

      // Get recent activity
      let recentActivity: any[] = [];
      try {
        const recentLogs = await prisma.usageLog.findMany({
          where: { userId: dbUser.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            createdAt: true,
            toolName: true,
            success: true,
            responseTimeMs: true,
          },
        });

        recentActivity = recentLogs.map((log: any) => ({
          timestamp: log.createdAt,
          toolName: log.toolName,
          success: log.success,
          responseTimeMs: log.responseTimeMs || 0,
        }));
      } catch {
        // Empty activity
      }

      const responseData = {
        success: true,
        data: {
          totalKeys: apiKeys.length,
          totalRequestsToday,
          totalRequestsMonth,
          averageSuccessRate: Math.round(avgSuccessRate * 10) / 10,
          subscription: {
            plan: tier,
            dailyLimit: limits.dailyLimit,
            monthlyLimit: limits.monthlyLimit,
            usedToday: totalRequestsToday,
            usedMonth: totalRequestsMonth,
          },
          keys: keysWithStats,
          recentActivity,
        },
      };

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      });
    } catch (statsError) {
      logger.error('Stats error:', statsError);
      return NextResponse.json({
        success: true,
        data: getEmptyStats(),
      });
    }
  } catch (error) {
    logger.error('Dashboard API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
