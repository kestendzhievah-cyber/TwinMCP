import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

// Validate Firebase token or API key
async function validateAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const firebaseAdmin = await import('firebase-admin');
      if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
      
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      return { valid: true, userId: decodedToken.uid, email: decodedToken.email };
    } catch (error) {
      // Try as API key
      const keyHash = createHash('sha256').update(token).digest('hex');
      const key = await prisma.apiKey.findUnique({
        where: { keyHash }
      });
      
      if (key && key.isActive) {
        return { valid: true, userId: key.userId };
      }
      return { valid: false, error: 'Invalid token' };
    }
  }

  if (apiKey) {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const key = await prisma.apiKey.findUnique({
      where: { keyHash }
    });
    
    if (key && key.isActive) {
      return { valid: true, userId: key.userId };
    }
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: false, error: 'No authentication provided' };
}

// GET - Get real-time usage statistics
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const userId = auth.userId!;
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');
    const timeRange = searchParams.get('range') || '24h'; // 24h, 7d, 30d

    // Find user in database
    const user = await prisma.user.findFirst({
      where: { 
        OR: [
          { id: userId },
          { oauthId: userId }
        ]
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate time boundaries
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // 24h
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Build query conditions
    const whereConditions: { userId: string; createdAt: { gte: Date }; apiKeyId?: string } = {
      userId: user.id,
      createdAt: { gte: startDate }
    };

    if (keyId) {
      whereConditions.apiKeyId = keyId;
    }

    // Get usage logs
    const logs = await prisma.usageLog.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        toolName: true,
        success: true,
        responseTimeMs: true,
        createdAt: true,
        apiKeyId: true
      }
    });

    // Calculate statistics
    const totalRequests = logs.length;
    const successfulRequests = logs.filter((l: typeof logs[number]) => l.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 1000) / 10 : 100;
    
    const responseTimes = logs
      .map((l: typeof logs[number]) => l.responseTimeMs)
      .filter((t: number | null): t is number => t !== null);
    
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : 0;

    // Get usage by hour for the chart
    const hourlyUsage: { hour: string; count: number; success: number; failed: number }[] = [];
    const hoursMap = new Map<string, { count: number; success: number; failed: number }>();
    
    logs.forEach((log: typeof logs[number]) => {
      const hourKey = log.createdAt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const existing = hoursMap.get(hourKey) || { count: 0, success: 0, failed: 0 };
      existing.count++;
      if (log.success) existing.success++;
      else existing.failed++;
      hoursMap.set(hourKey, existing);
    });

    // Sort by hour
    Array.from(hoursMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([hour, data]) => {
        hourlyUsage.push({ hour, ...data });
      });

    // Get usage by tool
    const toolUsage = new Map<string, { count: number; success: number; totalTime: number }>();
    logs.forEach((log: typeof logs[number]) => {
      const existing = toolUsage.get(log.toolName) || { count: 0, success: 0, totalTime: 0 };
      existing.count++;
      if (log.success) existing.success++;
      if (log.responseTimeMs) existing.totalTime = existing.totalTime + log.responseTimeMs;
      toolUsage.set(log.toolName, existing);
    });

    const toolBreakdown = Array.from(toolUsage.entries()).map(([tool, data]) => ({
      tool,
      count: data.count,
      successRate: Math.round((data.success / data.count) * 1000) / 10,
      avgResponseTime: Math.round(data.totalTime / data.count)
    }));

    // Get current quotas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsage = await prisma.usageLog.count({
      where: {
        userId: user.id,
        createdAt: { gte: today }
      }
    });

    // Get user's subscription tier
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });

    const plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    const LIMITS: Record<string, { daily: number; monthly: number }> = {
      free: { daily: 200, monthly: 6000 },
      pro: { daily: 10000, monthly: 300000 },
      enterprise: { daily: 100000, monthly: 3000000 }
    };

    const limits = LIMITS[plan] || LIMITS.free;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRequests,
          successfulRequests,
          failedRequests,
          successRate,
          avgResponseTime,
          timeRange
        },
        quota: {
          plan,
          dailyLimit: limits.daily,
          dailyUsed: todayUsage,
          dailyRemaining: Math.max(0, limits.daily - todayUsage),
          percentUsed: Math.round((todayUsage / limits.daily) * 100)
        },
        hourlyUsage,
        toolBreakdown,
        recentActivity: logs.slice(0, 50).map((log: typeof logs[number]) => ({
          id: log.id,
          tool: log.toolName,
          success: log.success,
          responseTime: log.responseTimeMs,
          timestamp: log.createdAt.toISOString()
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Usage stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
