import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 2, rateLimit: 20 },
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
        console.warn('Firebase Admin verification failed, trying JWT extraction');
      }
    }
    
    // Fallback: Extract user ID from JWT payload
    const extracted = extractUserIdFromToken(token);
    if (extracted) {
      return { valid: true, userId: extracted.userId, email: extracted.email };
    }
  }

  return { valid: false, error: 'No authentication provided' };
}

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
      usedMonth: 0
    },
    keys: [],
    recentActivity: []
  };
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

    const userId = auth.userId!;

    // Try to get or create user
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
        // Create default client if needed
        let defaultClient = await prisma.client.findFirst({
          where: { name: 'default' }
        });

        if (!defaultClient) {
          defaultClient = await prisma.client.create({
            data: { name: 'default', apiKeys: {} }
          });
        }

        // Create user
        dbUser = await prisma.user.create({
          data: {
            id: userId,
            email: auth.email || `user-${userId}@twinmcp.local`,
            oauthId: userId,
            oauthProvider: 'firebase',
            clientId: defaultClient.id
          }
        });
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyStats()
      });
    }

    // Get stats
    try {
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

      // Get API keys
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId: dbUser.id, isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate date boundaries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hourAgo = new Date(Date.now() - 3600000);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Get stats for each key
      const keysWithStats = await Promise.all(
        apiKeys.map(async (key: typeof apiKeys[number]) => {
          let dailyUsage = 0;
          let hourlyUsage = 0;
          let monthlyUsage = 0;
          let successRate = 100;

          try {
            const [daily, hourly, monthly, recentLogs] = await Promise.all([
              prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: today } } }),
              prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: hourAgo } } }),
              prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: monthStart } } }),
              prisma.usageLog.findMany({
                where: { apiKeyId: key.id },
                orderBy: { createdAt: 'desc' },
                take: 100
              })
            ]);

            dailyUsage = daily;
            hourlyUsage = hourly;
            monthlyUsage = monthly;

            if (recentLogs.length > 0) {
              const successCount = recentLogs.filter((log: any) => log.success).length;
              successRate = Math.round((successCount / recentLogs.length) * 1000) / 10;
            }
          } catch {
            // Keep defaults
          }

          return {
            id: key.id,
            keyPrefix: key.keyPrefix,
            name: key.name || 'Sans nom',
            tier: key.tier,
            quotaDaily: limits.dailyLimit,
            quotaHourly: limits.rateLimit,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() || null,
            usage: {
              requestsToday: dailyUsage,
              requestsThisHour: hourlyUsage,
              successRate
            }
          };
        })
      );

      // Calculate totals
      const totalRequestsToday = keysWithStats.reduce((sum, k) => sum + (k.usage?.requestsToday || 0), 0);
      const totalRequestsMonth = keysWithStats.reduce((sum, k) => sum + (k.usage?.requestsToday || 0), 0);
      const avgSuccessRate = keysWithStats.length > 0
        ? keysWithStats.reduce((sum, k) => sum + (k.usage?.successRate || 100), 0) / keysWithStats.length
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
            responseTimeMs: true
          }
        });

        recentActivity = recentLogs.map((log: any) => ({
          timestamp: log.createdAt,
          toolName: log.toolName,
          success: log.success,
          responseTimeMs: log.responseTimeMs || 0
        }));
      } catch {
        // Empty activity
      }

      return NextResponse.json({
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
            usedMonth: totalRequestsMonth
          },
          keys: keysWithStats,
          recentActivity
        }
      });

    } catch (statsError) {
      console.error('Stats error:', statsError);
      return NextResponse.json({
        success: true,
        data: getEmptyStats()
      });
    }

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
