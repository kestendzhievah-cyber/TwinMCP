import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 3, rateLimit: 20 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10, rateLimit: 200 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100, rateLimit: 2000 }
};

// Extract user ID from Firebase JWT token (without full verification for dev)
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
async function validateAuth(request: NextRequest): Promise<{ valid: boolean; userId?: string; email?: string; tier?: string; error?: string }> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  // Try Firebase token first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Try Firebase Admin if configured
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
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
        console.warn('Firebase verification failed:', firebaseError);
      }
    }
    
    // Fallback: Extract user ID from JWT payload (for development)
    const extracted = extractUserIdFromToken(token);
    if (extracted) {
      return { valid: true, userId: extracted.userId, email: extracted.email };
    }
    
    // Try as API key
    return validateApiKey(token);
  }

  // Try API key header
  if (apiKeyHeader) {
    return validateApiKey(apiKeyHeader);
  }

  return { valid: false, error: 'No authentication provided' };
}

async function validateApiKey(apiKey: string) {
  try {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const key = await prisma.apiKey.findUnique({
      where: { keyHash }
    });

    if (!key || !key.isActive) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: true, userId: key.userId, tier: key.tier };
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Database error' };
  }
}

// Ensure user exists in database
async function ensureUser(userId: string, email?: string) {
  try {
    let user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { oauthId: userId }] }
    });

    if (!user) {
      // Get or create default client
      let defaultClient = await prisma.client.findFirst({
        where: { name: 'default' }
      });

      if (!defaultClient) {
        defaultClient = await prisma.client.create({
          data: { name: 'default', apiKeys: {} }
        });
      }

      user = await prisma.user.create({
        data: {
          id: userId,
          email: email || `user-${userId}@twinmcp.local`,
          oauthId: userId,
          oauthProvider: 'firebase',
          clientId: defaultClient.id
        }
      });
    }

    return user;
  } catch (error) {
    console.error('Error ensuring user:', error);
    throw error;
  }
}

// GET - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const user = await ensureUser(auth.userId!, auth.email);

    // Get user's plan
    let plan = 'free';
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
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
      where: { userId: user.id, isActive: true, revokedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    // Get usage stats for each key
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hourAgo = new Date(Date.now() - 3600000);

    const keysWithStats = await Promise.all(
      apiKeys.map(async (key: typeof apiKeys[number]) => {
        let dailyUsage = 0;
        let hourlyUsage = 0;
        let successRate = 100;

        try {
          const [daily, hourly, recentLogs] = await Promise.all([
            prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: today } } }),
            prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: hourAgo } } }),
            prisma.usageLog.findMany({
              where: { apiKeyId: key.id },
              orderBy: { createdAt: 'desc' },
              take: 100
            })
          ]);

          dailyUsage = daily;
          hourlyUsage = hourly;

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
          quotaRequestsPerDay: limits.dailyLimit,
          quotaRequestsPerMinute: limits.rateLimit,
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

    return NextResponse.json({
      success: true,
      data: keysWithStats,
      subscription: {
        plan: tier,
        limits: limits
      }
    });

  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const user = await ensureUser(auth.userId!, auth.email);

    // Get user's plan
    let plan = 'free';
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
        include: { subscriptions: { where: { status: 'ACTIVE' } } }
      });
      plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    } catch {
      // Default to free
    }

    const tier = plan as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

    // Check key limit
    const existingKeys = await prisma.apiKey.count({
      where: { userId: user.id, isActive: true, revokedAt: null }
    });

    if (existingKeys >= limits.maxKeys) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Limite de ${limits.maxKeys} clés atteinte pour le plan ${tier}. Passez au plan supérieur pour plus de clés.`,
          code: 'KEY_LIMIT_EXCEEDED'
        },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate API key
    const rawKey = `twinmcp_${tier === 'free' ? 'free' : 'live'}_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 20);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash,
        keyPrefix,
        name: name.trim(),
        tier,
        quotaDaily: limits.dailyLimit,
        quotaMonthly: limits.monthlyLimit,
        permissions: ['read', 'write']
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        key: rawKey, // Only returned once!
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        tier: apiKey.tier,
        quotaRequestsPerDay: limits.dailyLimit,
        quotaRequestsPerMinute: limits.rateLimit,
        createdAt: apiKey.createdAt.toISOString(),
        usage: { requestsToday: 0, requestsThisHour: 0, successRate: 100 }
      },
      warning: 'Sauvegardez cette clé maintenant. Elle ne sera plus affichée.'
    });

  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Revoke API key
export async function DELETE(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const user = await ensureUser(auth.userId!, auth.email);

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: user.id }
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    // Soft delete (deactivate)
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false, revokedAt: new Date() }
    });

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('Revoke API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
