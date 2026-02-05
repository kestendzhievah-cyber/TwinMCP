import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PLAN_LIMITS } from '@/lib/services/usage.service';
import { createHash } from 'crypto';

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Validate Firebase token or API key
async function validateAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Try Firebase validation first
    try {
      // Check if Firebase is configured
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.warn('Firebase Admin not configured, skipping token validation');
        // Try to decode JWT manually for userId (basic check)
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            if (payload.user_id || payload.sub) {
              return { 
                valid: true, 
                userId: payload.user_id || payload.sub, 
                email: payload.email 
              };
            }
          } catch {
            // Fall through to API key check
          }
        }
        return validateApiKey(token);
      }

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
    } catch (error) {
      console.error('Firebase token validation error:', error);
      // Try as API key if Firebase validation fails
      return validateApiKey(token);
    }
  }

  if (apiKey) {
    return validateApiKey(apiKey);
  }

  return { valid: false, error: 'No authentication provided' };
}

async function validateApiKey(apiKey: string) {
  try {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true }
    });

    if (!key || !key.isActive) {
      return { valid: false, error: 'Invalid or inactive API key' };
    }

    return { valid: true, userId: key.userId, apiKeyId: key.id, tier: key.tier };
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Database error during validation' };
  }
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

    // Get or create user in database
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
        // Create default client if not exists
        let defaultClient = await prisma.client.findFirst({
          where: { name: 'default' }
        });

        if (!defaultClient) {
          defaultClient = await prisma.client.create({
            data: {
              name: 'default',
              apiKeys: {}
            }
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
      console.error('Database error finding/creating user:', dbError);
      // Return empty stats if database fails
      return NextResponse.json({
        success: true,
        data: getEmptyStats()
      });
    }

    // Get stats from database
    try {
      const stats = await getDashboardStats(dbUser.id);
      return NextResponse.json({
        success: true,
        data: stats
      });
    } catch (statsError) {
      console.error('Error getting stats:', statsError);
      return NextResponse.json({
        success: true,
        data: getEmptyStats()
      });
    }

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// Get dashboard statistics
async function getDashboardStats(userId: string) {
  // Get user's subscription/plan
  let plan = 'free';
  try {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });
    plan = userProfile?.subscriptions?.[0]?.plan || 'free';
  } catch {
    // Default to free plan
  }

  const tier = plan as 'free' | 'pro' | 'enterprise';
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

  // Get all user's API keys
  let apiKeys: any[] = [];
  try {
    apiKeys = await prisma.apiKey.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  } catch {
    // Empty keys on error
  }

  // Calculate date boundaries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hourAgo = new Date(Date.now() - 3600000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Get usage stats for each key
  const keysWithStats = await Promise.all(
    apiKeys.map(async (key) => {
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
        // Keep defaults on error
      }

      return {
        apiKeyId: key.id,
        keyName: key.name || 'Sans nom',
        keyPrefix: key.keyPrefix,
        tier: key.tier,
        quotaDaily: limits.dailyLimit,
        usedToday: dailyUsage,
        usedThisHour: hourlyUsage,
        usedThisMonth: monthlyUsage,
        remainingToday: Math.max(0, limits.dailyLimit - dailyUsage),
        successRate,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt
      };
    })
  );

  // Calculate totals
  const totalRequestsToday = keysWithStats.reduce((sum, k) => sum + k.usedToday, 0);
  const totalRequestsMonth = keysWithStats.reduce((sum, k) => sum + k.usedThisMonth, 0);
  const avgSuccessRate = keysWithStats.length > 0
    ? keysWithStats.reduce((sum, k) => sum + k.successRate, 0) / keysWithStats.length
    : 100;

  // Get recent activity
  let recentActivity: any[] = [];
  try {
    const recentLogs = await prisma.usageLog.findMany({
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

    recentActivity = recentLogs.map((log: any) => ({
      timestamp: log.createdAt,
      toolName: log.toolName,
      success: log.success,
      responseTimeMs: log.responseTimeMs || 0
    }));
  } catch {
    // Empty activity on error
  }

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
    keys: keysWithStats,
    recentActivity
  };
}

// Empty stats for fallback
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
