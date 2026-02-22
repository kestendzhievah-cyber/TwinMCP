import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// Internal key for server-to-server communication
const INTERNAL_KEY = process.env.TWINMCP_INTERNAL_KEY || ''

export async function POST(request: NextRequest) {
  try {
    // Verify internal key for server-to-server calls
    const internalKey = request.headers.get('x-internal-key')
    if (INTERNAL_KEY && internalKey !== INTERNAL_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_INTERNAL_KEY'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      apiKeyId,
      userId,
      toolName,
      libraryId,
      query,
      tokensReturned,
      responseTimeMs,
      success,
      errorMessage,
      timestamp
    } = body

    if (!apiKeyId || !userId || !toolName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: apiKeyId, userId, toolName',
        code: 'INVALID_REQUEST'
      }, { status: 400 })
    }

    const now = new Date(timestamp || Date.now())
    const dayKey = `quota:daily:${apiKeyId}:${now.toISOString().slice(0, 10)}`
    const monthKey = `quota:monthly:${apiKeyId}:${now.toISOString().slice(0, 7)}`

    // Increment usage counters in Redis
    const pipeline = redis.pipeline()
    pipeline.incr(dayKey)
    pipeline.expire(dayKey, 86400 * 2) // 2 days TTL
    pipeline.incr(monthKey)
    pipeline.expire(monthKey, 86400 * 35) // 35 days TTL
    await pipeline.exec()

    // Log usage to database
    await prisma.usageLog.create({
      data: {
        apiKeyId,
        userId,
        toolName,
        libraryId: libraryId || null,
        query: query || null,
        tokensReturned: tokensReturned || 0,
        responseTimeMs: responseTimeMs || 0,
        success: success ?? true,
        errorMessage: errorMessage || null,
        createdAt: now
      }
    })

    // Update API key usage stats
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { usedDaily: true, usedMonthly: true, lastUsedAt: true }
    })

    if (apiKeyRecord) {
      const isSameDay = apiKeyRecord.lastUsedAt && 
        apiKeyRecord.lastUsedAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
      const isSameMonth = apiKeyRecord.lastUsedAt && 
        apiKeyRecord.lastUsedAt.toISOString().slice(0, 7) === now.toISOString().slice(0, 7)

      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          usedDaily: isSameDay ? apiKeyRecord.usedDaily + 1 : 1,
          usedMonthly: isSameMonth ? apiKeyRecord.usedMonthly + 1 : 1,
          lastUsedAt: now
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
      timestamp: now.toISOString()
    })

  } catch (error) {
    logger.error('Error tracking usage:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to track usage',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve usage statistics
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('authorization')?.replace('Bearer ', '')

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      }, { status: 401 })
    }

    // Find API key
    const keyPrefix = apiKey.slice(0, 20)
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyPrefix: keyPrefix,
        revokedAt: null,
        isActive: true
      }
    })

    if (!apiKeyRecord) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      }, { status: 401 })
    }

    // Get usage stats from Redis
    const now = new Date()
    const dayKey = `quota:daily:${apiKeyRecord.id}:${now.toISOString().slice(0, 10)}`
    const monthKey = `quota:monthly:${apiKeyRecord.id}:${now.toISOString().slice(0, 7)}`

    const [dailyUsed, monthlyUsed] = await Promise.all([
      redis.get(dayKey).then(v => parseInt(v || '0', 10)),
      redis.get(monthKey).then(v => parseInt(v || '0', 10))
    ])

    // Get recent usage logs
    const recentLogs = await prisma.usageLog.findMany({
      where: { apiKeyId: apiKeyRecord.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        toolName: true,
        libraryId: true,
        tokensReturned: true,
        responseTimeMs: true,
        success: true,
        createdAt: true
      }
    })

    // Calculate statistics
    const stats = await prisma.usageLog.aggregate({
      where: { apiKeyId: apiKeyRecord.id },
      _count: { id: true },
      _sum: { tokensReturned: true },
      _avg: { responseTimeMs: true }
    })

    return NextResponse.json({
      success: true,
      usage: {
        apiKeyId: apiKeyRecord.id,
        tier: apiKeyRecord.tier,
        quota: {
          daily: {
            limit: apiKeyRecord.quotaDaily,
            used: dailyUsed,
            remaining: Math.max(0, apiKeyRecord.quotaDaily - dailyUsed)
          },
          monthly: {
            limit: apiKeyRecord.quotaMonthly,
            used: monthlyUsed,
            remaining: Math.max(0, apiKeyRecord.quotaMonthly - monthlyUsed)
          }
        },
        statistics: {
          totalRequests: stats._count.id,
          totalTokens: stats._sum.tokensReturned || 0,
          avgResponseTimeMs: Math.round(stats._avg.responseTimeMs || 0)
        },
        recentActivity: recentLogs
      },
      timestamp: now.toISOString()
    })

  } catch (error) {
    logger.error('Error getting usage stats:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get usage statistics',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
}
