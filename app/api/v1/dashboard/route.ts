import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { ensureUser, getUserTier, getApiKeyLimits, listApiKeys } from '@/lib/services/api-key.service';

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

    // Use centralized ensureUser (eliminates duplicated user-creation logic)
    let dbUser;
    try {
      dbUser = await ensureUser(userId, auth.email);
    } catch (dbError) {
      logger.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyStats(),
      });
    }

    // Get stats
    try {
      // Use centralized getUserTier + getApiKeyLimits + listApiKeys (eliminates duplicated logic)
      const tier = await getUserTier(dbUser.id);
      const limits = getApiKeyLimits(tier);

      // Use centralized listApiKeys (batch stats included, no duplication)
      const { keys: keysWithStats } = await listApiKeys(dbUser.id, tier);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Calculate totals
      const totalRequestsToday = keysWithStats.reduce(
        (sum, k) => sum + (k.usage?.requestsToday || 0),
        0
      );
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
      let recentActivity: { timestamp: Date; toolName: string; success: boolean; responseTimeMs: number }[] = [];
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

        recentActivity = recentLogs.map((log: (typeof recentLogs)[number]) => ({
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
          totalKeys: keysWithStats.length,
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
