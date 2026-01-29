import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import Redis from 'ioredis'

const prisma = new PrismaClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('authorization')?.replace('Bearer ', '')

    if (!apiKey) {
      return NextResponse.json({
        valid: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      }, { status: 401 })
    }

    if (!apiKey.startsWith('twinmcp_')) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid API key format',
        code: 'INVALID_FORMAT'
      }, { status: 401 })
    }

    // Extract prefix for lookup
    const keyPrefix = apiKey.slice(0, 20)

    // Find API key in database
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyPrefix: keyPrefix,
        revokedAt: null,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            clientId: true
          }
        }
      }
    })

    if (!apiKeyRecord) {
      return NextResponse.json({
        valid: false,
        error: 'API key not found or revoked',
        code: 'INVALID_API_KEY'
      }, { status: 401 })
    }

    // Verify hash
    const isValid = await bcrypt.compare(apiKey, apiKeyRecord.keyHash)
    if (!isValid) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      }, { status: 401 })
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return NextResponse.json({
        valid: false,
        error: 'API key has expired',
        code: 'EXPIRED_API_KEY'
      }, { status: 401 })
    }

    // Check quotas
    const now = new Date()
    const dayKey = `quota:daily:${apiKeyRecord.id}:${now.toISOString().slice(0, 10)}`
    const monthKey = `quota:monthly:${apiKeyRecord.id}:${now.toISOString().slice(0, 7)}`

    const [dailyUsed, monthlyUsed] = await Promise.all([
      redis.get(dayKey).then(v => parseInt(v || '0', 10)),
      redis.get(monthKey).then(v => parseInt(v || '0', 10))
    ])

    if (apiKeyRecord.quotaDaily !== -1 && dailyUsed >= apiKeyRecord.quotaDaily) {
      return NextResponse.json({
        valid: false,
        error: 'Daily quota exceeded',
        code: 'QUOTA_EXCEEDED',
        quotaInfo: {
          dailyLimit: apiKeyRecord.quotaDaily,
          dailyUsed,
          monthlyLimit: apiKeyRecord.quotaMonthly,
          monthlyUsed
        }
      }, { status: 429 })
    }

    if (apiKeyRecord.quotaMonthly !== -1 && monthlyUsed >= apiKeyRecord.quotaMonthly) {
      return NextResponse.json({
        valid: false,
        error: 'Monthly quota exceeded',
        code: 'QUOTA_EXCEEDED',
        quotaInfo: {
          dailyLimit: apiKeyRecord.quotaDaily,
          dailyUsed,
          monthlyLimit: apiKeyRecord.quotaMonthly,
          monthlyUsed
        }
      }, { status: 429 })
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    })

    return NextResponse.json({
      valid: true,
      userId: apiKeyRecord.userId,
      apiKeyId: apiKeyRecord.id,
      tier: apiKeyRecord.tier,
      quotaDaily: apiKeyRecord.quotaDaily,
      quotaMonthly: apiKeyRecord.quotaMonthly,
      usedDaily: dailyUsed,
      usedMonthly: monthlyUsed,
      permissions: apiKeyRecord.permissions
    })

  } catch (error) {
    console.error('Error validating API key:', error)
    return NextResponse.json({
      valid: false,
      error: 'Authentication failed',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
}
