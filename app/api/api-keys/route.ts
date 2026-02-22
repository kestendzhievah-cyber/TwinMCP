import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'

// â”€â”€â”€ Plan limits â”€â”€â”€
const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 3, rateLimit: 20 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10, rateLimit: 200 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100, rateLimit: 2000 },
} as const

type PlanTier = keyof typeof PLAN_LIMITS

const ALLOW_INSECURE_DEV_AUTH =
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_DEV_AUTH === 'true'

// â”€â”€â”€ Auth: Firebase JWT or API key â”€â”€â”€
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; email?: string } | null> {
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')

  // 1) Firebase JWT (Bearer token from dashboard)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)

    // Skip if it looks like an API key (twinmcp_ prefix)
    if (!token.startsWith('twinmcp_')) {
      // Try Firebase Admin verification
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        try {
          const firebaseAdmin = await import('firebase-admin')
          if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp({
              credential: firebaseAdmin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              }),
            })
          }
          const decoded = await firebaseAdmin.auth().verifyIdToken(token)
          return { userId: decoded.uid, email: decoded.email }
        } catch {
          // Fall through to JWT decode
        }
      }

      // Fallback is explicitly allowed only in non-production development flows
      if (ALLOW_INSECURE_DEV_AUTH) {
        try {
          const parts = token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
            const userId = payload.user_id || payload.sub || payload.uid
            if (userId) {
              logger.warn('Using insecure dev auth fallback (unverified JWT payload).')
              return { userId, email: payload.email }
            }
          }
        } catch {
          // Invalid JWT
        }
      }
    }
  }

  // 2) API key auth (x-api-key header or Bearer twinmcp_...)
  const rawKey = apiKeyHeader || (authHeader?.startsWith('Bearer twinmcp_') ? authHeader.substring(7) : null)
  if (rawKey) {
    try {
      const keyHash = createHash('sha256').update(rawKey).digest('hex')
      const key = await prisma.apiKey.findUnique({ where: { keyHash } })
      if (key && key.isActive && !key.revokedAt) {
        return { userId: key.userId }
      }
    } catch {
      // DB error
    }
  }

  return null
}

// â”€â”€â”€ Ensure user exists in DB â”€â”€â”€
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const hourAgo = new Date(Date.now() - 3600000)

    const keysWithStats = await Promise.all(
      apiKeys.map(async (key: typeof apiKeys[number]) => {
        let requestsToday = 0
        let requestsThisHour = 0
        let successRate = 100

        try {
          const [daily, hourly, recentLogs] = await Promise.all([
            prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: today } } }),
            prisma.usageLog.count({ where: { apiKeyId: key.id, createdAt: { gte: hourAgo } } }),
            prisma.usageLog.findMany({
              where: { apiKeyId: key.id },
              orderBy: { createdAt: 'desc' },
              take: 100,
              select: { success: true },
            }),
          ])
          requestsToday = daily
          requestsThisHour = hourly
          if (recentLogs.length > 0) {
            const ok = recentLogs.filter((l: { success: boolean }) => l.success).length
            successRate = Math.round((ok / recentLogs.length) * 1000) / 10
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
          usage: { requestsToday, requestsThisHour, successRate },
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: keysWithStats,
      subscription: { plan: tier, limits },
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

    // Parse body
    let body: { name?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name } = body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

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
