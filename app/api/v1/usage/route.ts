import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Extract user ID from Firebase JWT token
function extractUserIdFromToken(token: string): { userId: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const userId = payload.user_id || payload.sub || payload.uid;
    
    if (!userId) return null;
    
    return { userId, email: payload.email };
  } catch {
    return null;
  }
}

// Validate auth header
async function validateAuthHeader(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);

  // Try Firebase Admin if fully configured
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
      const firebaseAdmin = await import('firebase-admin');
      if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }
      
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      return { userId: decodedToken.uid };
    } catch {
      // Fall through to JWT extraction
    }
  }

  // Fallback: Extract user ID from JWT payload
  const extracted = extractUserIdFromToken(token);
  if (extracted) {
    return { userId: extracted.userId };
  }

  return null;
}

// GET - Get usage statistics for user
export async function GET(request: NextRequest) {
  const auth = await validateAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // Get usage logs
    const usageLogs = await prisma.usageLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // Aggregate by tool
    const byTool: Record<string, { count: number; tokens: number; avgResponseTime: number }> = {};
    let totalRequests = 0;
    let totalTokens = 0;
    let totalResponseTime = 0;
    let successCount = 0;

    for (const log of usageLogs) {
      totalRequests++;
      totalTokens += log.tokensReturned || 0;
      totalResponseTime += log.responseTimeMs || 0;
      if (log.success) successCount++;

      if (!byTool[log.toolName]) {
        byTool[log.toolName] = { count: 0, tokens: 0, avgResponseTime: 0 };
      }
      byTool[log.toolName].count++;
      byTool[log.toolName].tokens += log.tokensReturned || 0;
      byTool[log.toolName].avgResponseTime += log.responseTimeMs || 0;
    }

    // Calculate averages
    for (const tool of Object.keys(byTool)) {
      byTool[tool].avgResponseTime = Math.round(byTool[tool].avgResponseTime / byTool[tool].count);
    }

    // Get usage over time (hourly for day, daily for week/month)
    const usageOverTime: { timestamp: string; requests: number; tokens: number }[] = [];
    const bucketSize = period === 'day' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const buckets: Record<number, { requests: number; tokens: number }> = {};

    for (const log of usageLogs) {
      const bucketTime = Math.floor(log.createdAt.getTime() / bucketSize) * bucketSize;
      if (!buckets[bucketTime]) {
        buckets[bucketTime] = { requests: 0, tokens: 0 };
      }
      buckets[bucketTime].requests++;
      buckets[bucketTime].tokens += log.tokensReturned || 0;
    }

    // Sort and format
    const sortedBuckets = Object.entries(buckets)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([timestamp, data]) => ({
        timestamp: new Date(parseInt(timestamp)).toISOString(),
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

    return NextResponse.json({
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
      quotas: apiKeys.map((key: typeof apiKeys[number]) => ({
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
    });
  } catch (error) {
    console.error('Failed to fetch usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage statistics' },
      { status: 500 }
    );
  }
}

// POST - Log a usage event (internal use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKeyId, userId, toolName, libraryId, query, tokensReturned, responseTimeMs, success, errorMessage } = body;

    // Create usage log
    const log = await prisma.usageLog.create({
      data: {
        apiKeyId,
        userId,
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
    console.error('Failed to log usage:', error);
    return NextResponse.json(
      { error: 'Failed to log usage' },
      { status: 500 }
    );
  }
}
