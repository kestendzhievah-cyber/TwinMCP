import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import { createApiKeySchema, parseBody } from '@/lib/validations/api-schemas'
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth'

// ─── Plan limits ───
const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 3, rateLimit: 20 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10, rateLimit: 200 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100, rateLimit: 2000 },
} as const

type PlanTier = keyof typeof PLAN_LIMITS

// ─── Auth: shared Firebase Admin singleton + API key fallback ───
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; email?: string } | null> {
  const result = await validateAuthWithApiKey(request.headers.get('authorization'), request.headers.get('x-api-key'))
  return result.valid ? { userId: result.userId, email: result.email } : null
}

// ─── Ensure user exists in DB ───
async function ensureUser(userId: string, email?: string) {
  let user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { oauthId: userId }] },
  })

  if (!user) {
    let defaultClient = await prisma.client.findFirst({ where: { name: 'default' } })
    if (!defaultClient) {
      defaultClient = await prisma.client.create({ data: { name: 'default', apiKeys: {} } })
    }
    user = await prisma.user.create({
      data: {
        id: userId,
        email: email || `user-${userId}@twinmcp.local`,
        oauthId: userId,
        oauthProvider: 'firebase',
        clientId: defaultClient.id,
      },
    })
  }

  return user
}

// â”€â”€â”€ Get user plan tier â”€â”€â”€
async function getUserTier(userId: string): Promise<PlanTier> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { subscriptions: { where: { status: 'ACTIVE' } } },
    })
    const plan = profile?.subscriptions?.[0]?.plan || 'free'
    return (plan in PLAN_LIMITS ? plan : 'free') as PlanTier
  } catch {
    return 'free'
  }
}

// â”€â”€â”€ GET: List user's API keys with real usage stats â”€â”€â”€
export async function GET(request: NextRequest) {
  const start = Date.now()
  try {
    const auth = await authenticateRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const user = await ensureUser(auth.userId, auth.email)
    const tier = await getUserTier(user.id)
    const limits = PLAN_LIMITS[tier]

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: user.id, isActive: true, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    // Batch stats: use groupBy instead of per-key queries (N+1 fix)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const hourAgo = new Date(Date.now() - 3600000)
    const keyIds = apiKeys.map((k: typeof apiKeys[number]) => k.id)

    let dailyByKey = new Map<string, number>()
    let hourlyByKey = new Map<string, number>()
    let successByKey = new Map<string, number>()

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
        ])
        for (const row of dailyAgg) {
          if (row.apiKeyId) dailyByKey.set(row.apiKeyId, row._count)
        }
        for (const row of hourlyAgg) {
          if (row.apiKeyId) hourlyByKey.set(row.apiKeyId, row._count)
        }
        const logsByKey = new Map<string, { total: number; success: number }>()
        for (const log of recentLogs) {
          if (!log.apiKeyId) continue
          const entry = logsByKey.get(log.apiKeyId) || { total: 0, success: 0 }
          entry.total++
          if (log.success) entry.success++
          logsByKey.set(log.apiKeyId, entry)
        }
        for (const [kid, stats] of logsByKey) {
          successByKey.set(kid, stats.total > 0 ? Math.round((stats.success / stats.total) * 1000) / 10 : 100)
        }
      } catch {
        // Keep empty maps
      }
    }

    const keysWithStats = apiKeys.map((key: typeof apiKeys[number]) => ({
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
    }))

    return NextResponse.json({
      success: true,
      data: keysWithStats,
      subscription: { plan: tier, limits },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=5',
        'X-Response-Time': `${Date.now() - start}ms`,
      },
    })
  } catch (error) {
    logger.error('List API keys error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}

// â”€â”€â”€ POST: Create new API key â”€â”€â”€
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const user = await ensureUser(auth.userId, auth.email)
    const tier = await getUserTier(user.id)
    const limits = PLAN_LIMITS[tier]

    // Check key limit
    const existingCount = await prisma.apiKey.count({
      where: { userId: user.id, isActive: true, revokedAt: null },
    })
    if (existingCount >= limits.maxKeys) {
      return NextResponse.json(
        { success: false, error: `Limite de ${limits.maxKeys} clÃ©s atteinte pour le plan ${tier}.`, code: 'KEY_LIMIT_EXCEEDED' },
        { status: 400 }
      )
    }

    // Parse and validate body with Zod
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = parseBody(createApiKeySchema, rawBody)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error, details: parsed.details }, { status: 400 })
    }
    const { name } = parsed.data

    // Generate key
    const prefix = tier === 'free' ? 'twinmcp_free_' : 'twinmcp_live_'
    const randomPart = randomBytes(24).toString('hex')
    const rawKey = `${prefix}${randomPart}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.substring(0, 20)

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
    })

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
      warning: 'Sauvegardez cette clÃ© maintenant. Elle ne sera plus affichÃ©e.',
    })
  } catch (error) {
    logger.error('Create API key error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}

// â”€â”€â”€ DELETE: Revoke API key (by ?id= query param) â”€â”€â”€
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const user = await ensureUser(auth.userId, auth.email)

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json({ success: false, error: 'Key ID is required (?id=...)' }, { status: 400 })
    }

    // Verify ownership
    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: user.id },
    })
    if (!key) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 })
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false, revokedAt: new Date() },
    })

    return NextResponse.json({ success: true, message: 'API key revoked successfully' })
  } catch (error) {
    logger.error('Revoke API key error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
