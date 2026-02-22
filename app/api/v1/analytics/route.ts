import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOW_INSECURE_DEV_AUTH =
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_DEV_AUTH === 'true';

const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 3, rateLimit: 20 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10, rateLimit: 200 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100, rateLimit: 2000 }
};

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

// Validate authentication
async function validateAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
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
        return { valid: true, userId: decodedToken.uid, email: decodedToken.email };
      } catch (firebaseError) {
        logger.warn('Firebase Admin verification failed, trying JWT extraction');
      }
    }
    
    // Fallback is explicitly allowed only in non-production development flows
    if (ALLOW_INSECURE_DEV_AUTH) {
      const extracted = extractUserIdFromToken(token);
      if (extracted) {
        logger.warn('Using insecure dev auth fallback (unverified JWT payload).');
        return { valid: true, userId: extracted.userId, email: extracted.email };
      }
    }
  }

  return { valid: false, error: 'No authentication provided' };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day'; // day, week, month
    const userId = auth.userId!;

    // Find user
    let dbUser;
    try {
      dbUser = await prisma.user.findFirst({
        where: { 
          OR: [
            { id: userId },
            { oauthId: userId }
          ]
        }
      });

      if (!dbUser) {
        return NextResponse.json({
          success: true,
          data: getEmptyAnalytics(period)
        });
      }
    } catch (dbError) {
      logger.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyAnalytics(period)
      });
    }

    // Calculate date boundaries based on period
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
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    // Get user's plan
    let plan = 'free';
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: dbUser.id },
        include: { subscriptions: { where: { status: 'ACTIVE' } } }
      });
      plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    } catch {
      // Default to free
    }

    const tier = plan as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

    // Get user's API keys
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: dbUser.id, isActive: true },
      select: { id: true, name: true, keyPrefix: true, tier: true }
    });

    // Get usage logs for the period
    const usageLogs = await prisma.usageLog.findMany({
      where: {
        userId: dbUser.id,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate summary
    const totalRequests = usageLogs.length;
    const totalTokens = usageLogs.reduce((sum: number, log: typeof usageLogs[number]) => sum + (log.tokensReturned || 0), 0);
    const avgResponseTime = totalRequests > 0
      ? Math.round(usageLogs.reduce((sum: number, log: typeof usageLogs[number]) => sum + (log.responseTimeMs || 0), 0) / totalRequests)
      : 0;
    const successCount = usageLogs.filter((log: typeof usageLogs[number]) => log.success).length;
    const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 1000) / 10 : 100;

    // Group by tool
    const byToolMap = new Map<string, { count: number; tokens: number; totalTime: number }>();
    for (const log of usageLogs) {
      const toolName = log.toolName;
      const existing = byToolMap.get(toolName) || { count: 0, tokens: 0, totalTime: 0 };
      byToolMap.set(toolName, {
        count: existing.count + 1,
        tokens: existing.tokens + (log.tokensReturned || 0),
        totalTime: existing.totalTime + (log.responseTimeMs || 0)
      });
    }

    const byTool = Array.from(byToolMap.entries()).map(([tool, data]) => ({
      tool,
      count: data.count,
      tokens: data.tokens,
      avgResponseTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0
    })).sort((a, b) => b.count - a.count);

    // Group usage over time
    const timeSlots = period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const slotDuration = period === 'day' ? 3600000 : 86400000;
    
    const usageOverTime: { timestamp: string; requests: number; tokens: number }[] = [];
    for (let i = 0; i < timeSlots; i++) {
      const slotStart = new Date(startDate.getTime() + i * slotDuration);
      const slotEnd = new Date(slotStart.getTime() + slotDuration);
      
      const slotLogs = usageLogs.filter((log: typeof usageLogs[number]) => {
        const logTime = new Date(log.createdAt).getTime();
        return logTime >= slotStart.getTime() && logTime < slotEnd.getTime();
      });
      
      usageOverTime.push({
        timestamp: slotStart.toISOString(),
        requests: slotLogs.length,
        tokens: slotLogs.reduce((sum: number, log: typeof usageLogs[number]) => sum + (log.tokensReturned || 0), 0)
      });
    }

    // Calculate quota usage for each key
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const quotas = await Promise.all(
      apiKeys.map(async (key: typeof apiKeys[number]) => {
        const [dailyCount, monthlyCount] = await Promise.all([
          prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: today } } }),
          prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: monthStart } } })
        ]);

        const dailyPercentage = Math.round((dailyCount / limits.dailyLimit) * 1000) / 10;
        const monthlyPercentage = Math.round((monthlyCount / limits.monthlyLimit) * 1000) / 10;

        return {
          keyId: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name || 'Sans nom',
          tier: key.tier,
          daily: {
            used: dailyCount,
            limit: limits.dailyLimit,
            percentage: dailyPercentage,
            remaining: Math.max(0, limits.dailyLimit - dailyCount)
          },
          monthly: {
            used: monthlyCount,
            limit: limits.monthlyLimit,
            percentage: monthlyPercentage,
            remaining: Math.max(0, limits.monthlyLimit - monthlyCount)
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        period,
        summary: {
          totalRequests,
          totalTokens,
          avgResponseTime,
          successRate
        },
        byTool,
        usageOverTime,
        quotas
      }
    });

  } catch (error) {
    logger.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
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
      successRate: 100
    },
    byTool: [],
    usageOverTime: Array.from({ length: timeSlots }, (_, i) => ({
      timestamp: new Date(startDate.getTime() + i * slotDuration).toISOString(),
      requests: 0,
      tokens: 0
    })),
    quotas: []
  };
}
