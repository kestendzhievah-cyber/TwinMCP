import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';

const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 3, rateLimit: 20 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10, rateLimit: 200 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100, rateLimit: 2000 },
};

// Ensure user exists in database
async function ensureUser(userId: string, email?: string) {
  try {
    let user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { oauthId: userId }] },
    });

    if (!user) {
      // Get or create default client
      let defaultClient = await prisma.client.findFirst({
        where: { name: 'default' },
      });

      if (!defaultClient) {
        defaultClient = await prisma.client.create({
          data: { name: 'default', apiKeys: {} },
        });
      }

      user = await prisma.user.create({
        data: {
          id: userId,
          email: email || `user-${userId}@twinmcp.local`,
          oauthId: userId,
          oauthProvider: 'firebase',
          clientId: defaultClient.id,
        },
      });
    }

    return user;
  } catch (error) {
    logger.error('Error ensuring user:', error);
    throw error;
  }
}

// GET - List user's API keys
export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const auth = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );

    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const user = await ensureUser(auth.userId!, auth.email);

    // Get user's plan
    let plan = 'free';
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
        include: { subscriptions: { where: { status: 'ACTIVE' } } },
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
      orderBy: { createdAt: 'desc' },
    });

    // Batch stats: use groupBy instead of per-key queries (N+1 fix)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hourAgo = new Date(Date.now() - 3600000);
    const keyIds = apiKeys.map((k: (typeof apiKeys)[number]) => k.id);

    const dailyByKey = new Map<string, number>();
    const hourlyByKey = new Map<string, number>();
    const successByKey = new Map<string, number>();

    if (keyIds.length > 0) {
      try {
        const [dailyAgg, hourlyAgg, recentLogs] = await Promise.all([
          prisma.usageLog.groupBy({
            by: ['apiKeyId'],
            where: { apiKeyId: { in: keyIds }, createdAt: { gte: today } },
            _count: true,
          }),
          prisma.usageLog.groupBy({
            by: ['apiKeyId'],
            where: { apiKeyId: { in: keyIds }, createdAt: { gte: hourAgo } },
            _count: true,
          }),
          prisma.usageLog.findMany({
            where: { apiKeyId: { in: keyIds } },
            orderBy: { createdAt: 'desc' },
            take: keyIds.length * 50,
            select: { apiKeyId: true, success: true },
          }),
        ]);

        for (const row of dailyAgg) {
          if (row.apiKeyId) dailyByKey.set(row.apiKeyId, row._count);
        }
        for (const row of hourlyAgg) {
          if (row.apiKeyId) hourlyByKey.set(row.apiKeyId, row._count);
        }
        const logsByKey = new Map<string, { total: number; success: number }>();
        for (const log of recentLogs) {
          if (!log.apiKeyId) continue;
          const entry = logsByKey.get(log.apiKeyId) || { total: 0, success: 0 };
          entry.total++;
          if (log.success) entry.success++;
          logsByKey.set(log.apiKeyId, entry);
        }
        for (const [kid, stats] of logsByKey) {
          successByKey.set(
            kid,
            stats.total > 0 ? Math.round((stats.success / stats.total) * 1000) / 10 : 100
          );
        }
      } catch {
        // Keep empty maps
      }
    }

    const keysWithStats = apiKeys.map((key: (typeof apiKeys)[number]) => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      name: key.name || 'Sans nom',
      tier: key.tier,
      quotaRequestsPerDay: limits.dailyLimit,
      quotaRequestsPerMinute: limits.rateLimit,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      usage: {
        requestsToday: dailyByKey.get(key.id) || 0,
        requestsThisHour: hourlyByKey.get(key.id) || 0,
        successRate: successByKey.get(key.id) ?? 100,
      },
    }));

    return NextResponse.json(
      {
        success: true,
        data: keysWithStats,
        subscription: {
          plan: tier,
          limits,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=5',
          'X-Response-Time': `${Date.now() - start}ms`,
        },
      }
    );
  } catch (error) {
    logger.error('List API keys error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );

    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const user = await ensureUser(auth.userId!, auth.email);

    // Get user's plan
    let plan = 'free';
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
        include: { subscriptions: { where: { status: 'ACTIVE' } } },
      });
      plan = userProfile?.subscriptions?.[0]?.plan || 'free';
    } catch {
      // Default to free
    }

    const tier = plan as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

    // Check key limit
    const existingKeys = await prisma.apiKey.count({
      where: { userId: user.id, isActive: true, revokedAt: null },
    });

    if (existingKeys >= limits.maxKeys) {
      return NextResponse.json(
        {
          success: false,
          error: `Limite de ${limits.maxKeys} clés atteinte pour le plan ${tier}. Passez au plan supérieur pour plus de clés.`,
          code: 'KEY_LIMIT_EXCEEDED',
        },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
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
        permissions: ['read', 'write'],
      },
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
        usage: { requestsToday: 0, requestsThisHour: 0, successRate: 100 },
      },
      warning: 'Sauvegardez cette clé maintenant. Elle ne sera plus affichée.',
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Revoke API key
export async function DELETE(request: NextRequest) {
  try {
    const auth = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );

    if (!auth.valid) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const user = await ensureUser(auth.userId!, auth.email);

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ success: false, error: 'Key ID is required' }, { status: 400 });
    }

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: user.id },
    });

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    // Soft delete (deactivate)
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false, revokedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    logger.error('Revoke API key error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
