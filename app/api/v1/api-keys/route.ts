import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PLAN_LIMITS } from '@/lib/services/usage.service';

const prisma = new PrismaClient();

// Validate Firebase token or existing API key
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
      return validateApiKey(token);
    }
  }

  if (apiKey) {
    return validateApiKey(apiKey);
  }

  return { valid: false, error: 'No authentication provided' };
}

async function validateApiKey(apiKey: string) {
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true }
  });

  if (!key || !key.isActive) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true, userId: key.userId, tier: key.tier };
}

// Ensure user exists in database
async function ensureUser(userId: string, email?: string) {
  let user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { oauthId: userId }] }
  });

  if (!user) {
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

    // Get user's subscription to determine tier
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });

    const plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    const tier = plan as 'free' | 'pro' | 'enterprise';

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // Get usage stats for each key
    const keysWithStats = await Promise.all(
      apiKeys.map(async (key) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const hourAgo = new Date(Date.now() - 3600000);

        const [dailyUsage, hourlyUsage, totalLogs] = await Promise.all([
          prisma.usageLog.count({
            where: { apiKeyId: key.id, createdAt: { gte: today } }
          }),
          prisma.usageLog.count({
            where: { apiKeyId: key.id, createdAt: { gte: hourAgo } }
          }),
          prisma.usageLog.findMany({
            where: { apiKeyId: key.id },
            orderBy: { createdAt: 'desc' },
            take: 100
          })
        ]);

        const successCount = totalLogs.filter(log => log.success).length;
        const successRate = totalLogs.length > 0 
          ? Math.round((successCount / totalLogs.length) * 1000) / 10 
          : 100;

        const limits = PLAN_LIMITS[tier];

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

    return NextResponse.json({
      success: true,
      data: keysWithStats,
      subscription: {
        plan: tier,
        limits: PLAN_LIMITS[tier]
      }
    });

  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });

    const plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    const tier = plan as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier];

    // Check key limit
    const existingKeys = await prisma.apiKey.count({
      where: { userId: user.id, isActive: true }
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

    const body = await request.json();
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
        quotaDaily: limits.dailyLimit,
        createdAt: apiKey.createdAt.toISOString()
      },
      warning: 'Sauvegardez cette clé maintenant. Elle ne sera plus affichée.'
    });

  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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
