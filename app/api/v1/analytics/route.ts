import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { getApiKeyLimits } from '@/lib/services/api-key.service';
import { resolvePlanId } from '@/lib/services/stripe-billing.service';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const auth = await validateAuth(request.headers.get('authorization'));

    if (!auth.valid) {
      throw new AuthenticationError();
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day'; // day, week, month
    const userId = auth.userId!;

    // Find user
    let dbUser;
    try {
      dbUser = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { oauthId: userId }] },
        select: { id: true },
      });

      if (!dbUser) {
        return NextResponse.json({
          success: true,
          data: getEmptyAnalytics(period),
        });
      }
    } catch (dbError) {
      logger.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyAnalytics(period),
      });
    }

    // Calculate date boundaries based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 86400000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 86400000);
        break;
      default: // day
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    // Parallel: profile + API keys (independent queries)
    const [userProfile, apiKeys] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId: dbUser.id },
        select: { subscriptions: { where: { status: 'ACTIVE' }, select: { plan: true }, take: 1 } },
      }).catch(() => null),
      prisma.apiKey.findMany({
        where: { userId: dbUser.id, isActive: true },
        select: { id: true, name: true, keyPrefix: true, tier: true },
      }),
    ]);

    const plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    const resolvedTier = resolvePlanId(plan);
    const limits = getApiKeyLimits(resolvedTier);

    // Use DB-level aggregation instead of fetching all logs into memory
    const logWhere = { userId: dbUser.id, createdAt: { gte: startDate } };

    // Summary: count, sum tokens, avg response time — single DB roundtrip
    const [totalRequests, successCount, summaryAgg] = await Promise.all([
      prisma.usageLog.count({ where: logWhere }),
      prisma.usageLog.count({ where: { ...logWhere, success: true } }),
      prisma.usageLog.aggregate({
        where: logWhere,
        _sum: { tokensReturned: true, responseTimeMs: true },
      }),
    ]);

    const totalTokens = summaryAgg._sum.tokensReturned || 0;
    const avgResponseTime =
      totalRequests > 0
        ? Math.round((summaryAgg._sum.responseTimeMs || 0) / totalRequests)
        : 0;
    const successRate =
      totalRequests > 0 ? Math.round((successCount / totalRequests) * 1000) / 10 : 100;

    // Group by tool — DB-level groupBy instead of in-memory loop
    const toolAgg = await prisma.usageLog.groupBy({
      by: ['toolName'],
      where: logWhere,
      _count: true,
      _sum: { tokensReturned: true, responseTimeMs: true },
      orderBy: { _count: { toolName: 'desc' } },
    });

    const byTool = toolAgg.map((row) => ({
      tool: row.toolName,
      count: row._count,
      tokens: row._sum.tokensReturned || 0,
      avgResponseTime: row._count > 0 ? Math.round((row._sum.responseTimeMs || 0) / row._count) : 0,
    }));

    // Usage over time: fetch capped logs and bucket in memory (Map-based O(n))
    const timeSlots = period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const slotDuration = period === 'day' ? 3600000 : 86400000;

    const cappedLogs = await prisma.usageLog.findMany({
      where: logWhere,
      orderBy: { createdAt: 'asc' },
      take: 50000,
      select: { createdAt: true, tokensReturned: true },
    });

    // Bucket using Map — O(n) instead of O(n*slots)
    const buckets = new Map<number, { requests: number; tokens: number }>();
    const startMs = startDate.getTime();
    for (const log of cappedLogs) {
      const slotIdx = Math.floor((log.createdAt.getTime() - startMs) / slotDuration);
      const clamped = Math.max(0, Math.min(slotIdx, timeSlots - 1));
      const existing = buckets.get(clamped) || { requests: 0, tokens: 0 };
      existing.requests++;
      existing.tokens += log.tokensReturned || 0;
      buckets.set(clamped, existing);
    }

    const usageOverTime: { timestamp: string; requests: number; tokens: number }[] = [];
    for (let i = 0; i < timeSlots; i++) {
      const slotStart = new Date(startMs + i * slotDuration);
      const bucket = buckets.get(i) || { requests: 0, tokens: 0 };
      usageOverTime.push({ timestamp: slotStart.toISOString(), ...bucket });
    }

    // Calculate quota usage for each key
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Batch quota queries with groupBy instead of per-key (N+1 fix)
    const quotaKeyIds = apiKeys.map((k: (typeof apiKeys)[number]) => k.id);
    const dailyByKey = new Map<string, number>();
    const monthlyByKey = new Map<string, number>();

    if (quotaKeyIds.length > 0) {
      try {
        const [dailyAgg, monthlyAgg] = await Promise.all([
          prisma.usageLog.groupBy({
            by: ['apiKeyId'],
            where: { apiKeyId: { in: quotaKeyIds }, createdAt: { gte: today } },
            _count: true,
          }),
          prisma.usageLog.groupBy({
            by: ['apiKeyId'],
            where: { apiKeyId: { in: quotaKeyIds }, createdAt: { gte: monthStart } },
            _count: true,
          }),
        ]);
        for (const row of dailyAgg) {
          if (row.apiKeyId) dailyByKey.set(row.apiKeyId, row._count);
        }
        for (const row of monthlyAgg) {
          if (row.apiKeyId) monthlyByKey.set(row.apiKeyId, row._count);
        }
      } catch {
        // Keep empty maps
      }
    }

    const quotas = apiKeys.map((key: (typeof apiKeys)[number]) => {
      const dailyCount = dailyByKey.get(key.id) || 0;
      const monthlyCount = monthlyByKey.get(key.id) || 0;
      return {
        keyId: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name || 'Sans nom',
        tier: key.tier,
        daily: {
          used: dailyCount,
          limit: limits.dailyLimit,
          percentage: Math.round((dailyCount / limits.dailyLimit) * 1000) / 10,
          remaining: Math.max(0, limits.dailyLimit - dailyCount),
        },
        monthly: {
          used: monthlyCount,
          limit: limits.monthlyLimit,
          percentage: Math.round((monthlyCount / limits.monthlyLimit) * 1000) / 10,
          remaining: Math.max(0, limits.monthlyLimit - monthlyCount),
        },
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          period,
          summary: {
            totalRequests,
            totalTokens,
            avgResponseTime,
            successRate,
          },
          byTool,
          usageOverTime,
          quotas,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=15',
          'X-Response-Time': `${Date.now() - start}ms`,
        },
      }
    );
  } catch (error) {
    return handleApiError(error, 'V1Analytics');
  }
}

function getEmptyAnalytics(period: string) {
  const timeSlots = period === 'day' ? 24 : period === 'week' ? 7 : 30;
  const slotDuration = period === 'day' ? 3600000 : 86400000;
  const startDate = new Date();
  if (period === 'day') {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    startDate.setTime(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    startDate.setTime(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    period,
    summary: {
      totalRequests: 0,
      totalTokens: 0,
      avgResponseTime: 0,
      successRate: 100,
    },
    byTool: [],
    usageOverTime: Array.from({ length: timeSlots }, (_, i) => ({
      timestamp: new Date(startDate.getTime() + i * slotDuration).toISOString(),
      requests: 0,
      tokens: 0,
    })),
    quotas: [],
  };
}
