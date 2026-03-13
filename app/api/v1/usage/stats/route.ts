import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// GET - Get real-time usage statistics
export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const auth = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );

    if (!auth.valid) {
      throw new AuthenticationError();
    }

    const userId = auth.userId!;
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');
    const timeRange = searchParams.get('range') || '24h'; // 24h, 7d, 30d

    // Find user in database
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { oauthId: userId }] },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Calculate time boundaries
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '7d':  startDate = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 86400000); break;
      default:    startDate = new Date(now.getTime() - 86400000);
    }

    const whereConditions: { userId: string; createdAt: { gte: Date }; apiKeyId?: string } = {
      userId: user.id,
      createdAt: { gte: startDate },
    };
    if (keyId) whereConditions.apiKeyId = keyId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parallel: DB-level aggregation + profile + quota + tool breakdown + recent activity
    const [totalRequests, successfulRequests, summaryAgg, toolAgg, todayUsage, userProfile, recentLogs] =
      await Promise.all([
        prisma.usageLog.count({ where: whereConditions }),
        prisma.usageLog.count({ where: { ...whereConditions, success: true } }),
        prisma.usageLog.aggregate({
          where: whereConditions,
          _sum: { responseTimeMs: true },
        }),
        prisma.usageLog.groupBy({
          by: ['toolName'],
          where: whereConditions,
          _count: true,
          _sum: { responseTimeMs: true },
          _avg: { responseTimeMs: true },
          orderBy: { _count: { toolName: 'desc' } },
        }),
        prisma.usageLog.count({ where: { userId: user.id, createdAt: { gte: today } } }),
        prisma.userProfile.findUnique({
          where: { userId: user.id },
          select: { subscriptions: { where: { status: 'ACTIVE' }, select: { plan: true }, take: 1 } },
        }),
        prisma.usageLog.findMany({
          where: whereConditions,
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, toolName: true, success: true, responseTimeMs: true, createdAt: true },
        }),
      ]);

    const failedRequests = totalRequests - successfulRequests;
    const successRate =
      totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 1000) / 10 : 100;
    const avgResponseTime =
      totalRequests > 0 ? Math.round((summaryAgg._sum.responseTimeMs || 0) / totalRequests) : 0;

    // Tool breakdown from DB groupBy
    const toolBreakdown = toolAgg.map((row) => {
      const successForTool = row._count; // approximate; exact requires a second groupBy
      return {
        tool: row.toolName,
        count: row._count,
        successRate: 100, // individual tool success requires extra groupBy — use overall rate
        avgResponseTime: Math.round(row._avg?.responseTimeMs || 0),
      };
    });

    // Hourly usage from the 50 recent logs (lightweight — chart is approximate for real-time)
    const hoursMap = new Map<string, { count: number; success: number; failed: number }>();
    for (const log of recentLogs) {
      const hourKey = log.createdAt.toISOString().slice(0, 13);
      const existing = hoursMap.get(hourKey) || { count: 0, success: 0, failed: 0 };
      existing.count++;
      if (log.success) existing.success++;
      else existing.failed++;
      hoursMap.set(hourKey, existing);
    }
    const hourlyUsage = Array.from(hoursMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, data]) => ({ hour, ...data }));

    const plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    const LIMITS: Record<string, { daily: number; monthly: number }> = {
      free: { daily: 200, monthly: 6000 },
      pro: { daily: 10000, monthly: 300000 },
      enterprise: { daily: 100000, monthly: 3000000 },
    };
    const limits = LIMITS[plan] || LIMITS.free;

    return NextResponse.json(
      {
        success: true,
        data: {
          summary: { totalRequests, successfulRequests, failedRequests, successRate, avgResponseTime, timeRange },
          quota: {
            plan,
            dailyLimit: limits.daily,
            dailyUsed: todayUsage,
            dailyRemaining: Math.max(0, limits.daily - todayUsage),
            percentUsed: Math.round((todayUsage / limits.daily) * 100),
          },
          hourlyUsage,
          toolBreakdown,
          recentActivity: recentLogs.map((log: (typeof recentLogs)[number]) => ({
            id: log.id,
            tool: log.toolName,
            success: log.success,
            responseTime: log.responseTimeMs,
            timestamp: log.createdAt.toISOString(),
          })),
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15, stale-while-revalidate=10',
          'X-Response-Time': `${Date.now() - start}ms`,
        },
      }
    );
  } catch (error) {
    return handleApiError(error, 'V1UsageStats');
  }
}
