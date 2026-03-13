import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// GET - Get usage statistics for user
export async function GET(request: NextRequest) {
  const start = Date.now();
  const userId = await getAuthUserId(request.headers.get('authorization'));
  if (!userId) {
    return handleApiError(new AuthenticationError(), 'V1UsageGet');
  }
  const auth = { userId };

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'day'; // day, week, month
  const apiKeyId = searchParams.get('apiKeyId');

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // day
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Build where clause
    const whereClause: any = {
      userId: auth.userId,
      createdAt: { gte: startDate },
    };

    if (apiKeyId) {
      whereClause.apiKeyId = apiKeyId;
    }

    // DB-level aggregation — avoid fetching thousands of rows into memory
    const [totalRequests, successCount, summaryAgg, toolAgg] = await Promise.all([
      prisma.usageLog.count({ where: whereClause }),
      prisma.usageLog.count({ where: { ...whereClause, success: true } }),
      prisma.usageLog.aggregate({
        where: whereClause,
        _sum: { tokensReturned: true, responseTimeMs: true },
      }),
      prisma.usageLog.groupBy({
        by: ['toolName'],
        where: whereClause,
        _count: true,
        _sum: { tokensReturned: true, responseTimeMs: true },
        orderBy: { _count: { toolName: 'desc' } },
      }),
    ]);

    const totalTokens = summaryAgg._sum.tokensReturned || 0;
    const totalResponseTime = summaryAgg._sum.responseTimeMs || 0;

    const byTool: Record<string, { count: number; tokens: number; avgResponseTime: number }> = {};
    for (const row of toolAgg) {
      byTool[row.toolName] = {
        count: row._count,
        tokens: row._sum.tokensReturned || 0,
        avgResponseTime: row._count > 0 ? Math.round((row._sum.responseTimeMs || 0) / row._count) : 0,
      };
    }

    // Usage over time: fetch capped logs with only needed fields, bucket with Map
    const bucketSize = period === 'day' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const timeLogs = await prisma.usageLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 10000,
      select: { createdAt: true, tokensReturned: true },
    });

    const bucketMap = new Map<number, { requests: number; tokens: number }>();
    for (const log of timeLogs) {
      const bucketTime = Math.floor(log.createdAt.getTime() / bucketSize) * bucketSize;
      const existing = bucketMap.get(bucketTime) || { requests: 0, tokens: 0 };
      existing.requests++;
      existing.tokens += log.tokensReturned || 0;
      bucketMap.set(bucketTime, existing);
    }

    const sortedBuckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp).toISOString(),
        ...data,
      }));

    // Get API key quotas
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: auth.userId, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        tier: true,
        quotaDaily: true,
        quotaMonthly: true,
        usedDaily: true,
        usedMonthly: true,
      },
    });

    return NextResponse.json(
      {
        period,
        summary: {
          totalRequests,
          totalTokens,
          avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
          successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 100,
        },
        byTool: Object.entries(byTool).map(([name, stats]) => ({
          tool: name,
          ...stats,
        })),
        usageOverTime: sortedBuckets,
        quotas: apiKeys.map((key: (typeof apiKeys)[number]) => ({
          keyId: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          tier: key.tier,
          daily: {
            used: key.usedDaily,
            limit: key.quotaDaily,
            percentage: key.quotaDaily > 0 ? (key.usedDaily / key.quotaDaily) * 100 : 0,
            remaining: Math.max(0, key.quotaDaily - key.usedDaily),
          },
          monthly: {
            used: key.usedMonthly,
            limit: key.quotaMonthly,
            percentage: key.quotaMonthly > 0 ? (key.usedMonthly / key.quotaMonthly) * 100 : 0,
            remaining: Math.max(0, key.quotaMonthly - key.usedMonthly),
          },
        })),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15, stale-while-revalidate=10',
          'X-Response-Time': `${Date.now() - start}ms`,
        },
      }
    );
  } catch (error) {
    return handleApiError(error, 'V1UsageGet');
  }
}

// POST - Log a usage event (internal use)
export async function POST(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request.headers.get('authorization'));
    if (!authUserId) {
      throw new AuthenticationError();
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const {
      apiKeyId,
      userId,
      toolName,
      libraryId,
      query,
      tokensReturned,
      responseTimeMs,
      success,
      errorMessage,
    } = body;

    // Validate required fields
    if (!toolName || typeof toolName !== 'string' || toolName.length > 200) {
      return NextResponse.json({ error: 'Valid toolName is required (max 200 chars)' }, { status: 400 });
    }

    // Validate optional string fields — cap lengths to prevent oversized DB writes
    if (apiKeyId && (typeof apiKeyId !== 'string' || apiKeyId.length > 100)) {
      return NextResponse.json({ error: 'Invalid apiKeyId' }, { status: 400 });
    }
    if (query && (typeof query !== 'string' || query.length > 10000)) {
      return NextResponse.json({ error: 'query too long (max 10000 chars)' }, { status: 400 });
    }
    if (errorMessage && (typeof errorMessage !== 'string' || errorMessage.length > 2000)) {
      return NextResponse.json({ error: 'errorMessage too long (max 2000 chars)' }, { status: 400 });
    }

    // Validate numeric fields
    if (tokensReturned !== undefined && (typeof tokensReturned !== 'number' || !Number.isFinite(tokensReturned) || tokensReturned < 0)) {
      return NextResponse.json({ error: 'Invalid tokensReturned' }, { status: 400 });
    }
    if (responseTimeMs !== undefined && (typeof responseTimeMs !== 'number' || !Number.isFinite(responseTimeMs) || responseTimeMs < 0)) {
      return NextResponse.json({ error: 'Invalid responseTimeMs' }, { status: 400 });
    }

    // Prevent forging usage logs for other users
    const effectiveUserId = authUserId;
    if (userId && userId !== effectiveUserId) {
      return NextResponse.json({ error: 'Forbidden: userId mismatch' }, { status: 403 });
    }

    // Ensure apiKey belongs to authenticated user before logging/updating counters
    if (apiKeyId) {
      const ownedKey = await prisma.apiKey.findFirst({
        where: { id: apiKeyId, userId: effectiveUserId, isActive: true, revokedAt: null },
        select: { id: true },
      });
      if (!ownedKey) {
        return NextResponse.json({ error: 'Forbidden: invalid apiKeyId' }, { status: 403 });
      }
    }

    // Create usage log
    const log = await prisma.usageLog.create({
      data: {
        apiKeyId,
        userId: effectiveUserId,
        toolName,
        libraryId,
        query,
        tokensReturned,
        responseTimeMs,
        success: success ?? true,
        errorMessage,
      },
    });

    // Update API key usage counters
    if (apiKeyId) {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          usedDaily: { increment: 1 },
          usedMonthly: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ logged: true, id: log.id });
  } catch (error) {
    return handleApiError(error, 'V1UsagePost');
  }
}
