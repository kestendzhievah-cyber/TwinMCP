import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Redis } from 'ioredis'

export interface ApiKeyData {
  id: string
  userId: string
  keyPrefix: string
  tier: string
  quotaDaily: number
  quotaMonthly: number
  permissions: unknown
  quotaRequestsPerMinute: number
  quotaRequestsPerDay: number
}

export interface AuthResult {
  success: boolean
  apiKeyData?: ApiKeyData
  error?: string
  errorCode?: 'INVALID_API_KEY' | 'RATE_LIMITED' | 'EXPIRED_API_KEY' | 'INACTIVE_API_KEY'
  statusCode?: number
}

export class AuthService {
  private db: PrismaClient
  private redis: Redis

  constructor(db: PrismaClient, redis: Redis) {
    this.db = db
    this.redis = redis
  }

  async validateApiKey(apiKey: string): Promise<AuthResult> {
    try {
      if (!apiKey || !apiKey.startsWith('twinmcp_')) {
        return {
          success: false,
          error: 'Invalid API key format',
          errorCode: 'INVALID_API_KEY',
          statusCode: 401
        }
      }

      // Extraire le préfixe pour la recherche
      const keyPrefix = apiKey.slice(0, 20) // twinmcp_live_ ou twinmcp_test_
      
      // Rechercher la clé API dans la base de données
      const apiKeyRecord = await this.db.apiKey.findFirst({
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
        return {
          success: false,
          error: 'API key not found or revoked',
          errorCode: 'INVALID_API_KEY',
          statusCode: 401
        }
      }

      // Vérifier le hash
      const isValid = await bcrypt.compare(apiKey, apiKeyRecord.keyHash)
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid API key',
          errorCode: 'INVALID_API_KEY',
          statusCode: 401
        }
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        return {
          success: false,
          error: 'API key has expired',
          errorCode: 'EXPIRED_API_KEY',
          statusCode: 401
        }
      }

      // Vérifier les quotas
      const quotaCheck = await this.checkQuotas(apiKeyRecord.id, apiKeyRecord.quotaDaily, apiKeyRecord.quotaMonthly)
      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: quotaCheck.reason,
          errorCode: 'RATE_LIMITED',
          statusCode: 429
        }
      }

      // Mettre à jour le dernier usage
      await this.db.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() }
      })

      const quotaRequestsPerMinute = Math.max(1, Math.floor(apiKeyRecord.quotaDaily / (24 * 60)))

      return {
        success: true,
        apiKeyData: {
          id: apiKeyRecord.id,
          userId: apiKeyRecord.userId,
          keyPrefix: apiKeyRecord.keyPrefix,
          tier: apiKeyRecord.tier,
          quotaDaily: apiKeyRecord.quotaDaily,
          quotaMonthly: apiKeyRecord.quotaMonthly,
          permissions: apiKeyRecord.permissions,
          quotaRequestsPerMinute,
          quotaRequestsPerDay: apiKeyRecord.quotaDaily
        }
      }

    } catch (error) {
      console.error('Error validating API key:', error)
      return {
        success: false,
        error: 'Authentication failed',
        errorCode: 'INVALID_API_KEY',
        statusCode: 401
      }
    }
  }

  private async checkQuotas(apiKeyId: string, dailyLimit: number, monthlyLimit: number): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date()
    const dayKey = `quota:daily:${apiKeyId}:${now.toISOString().slice(0, 10)}`
    const monthKey = `quota:monthly:${apiKeyId}:${now.toISOString().slice(0, 7)}`

    if (dailyLimit !== -1) {
      const dayCount = await this.redis.incr(dayKey)
      if (dayCount === 1) {
        await this.redis.expire(dayKey, this.getSecondsUntilEndOfDay(now))
      }

      if (dayCount > dailyLimit) {
        return {
          allowed: false,
          reason: 'Daily quota exceeded'
        }
      }
    }

    if (monthlyLimit !== -1) {
      const monthCount = await this.redis.incr(monthKey)
      if (monthCount === 1) {
        await this.redis.expire(monthKey, this.getSecondsUntilEndOfMonth(now))
      }

      if (monthCount > monthlyLimit) {
        return {
          allowed: false,
          reason: 'Monthly quota exceeded'
        }
      }
    }

    return { allowed: true }
  }

  async generateApiKey(userId: string, name?: string): Promise<{ apiKey: string; prefix: string }> {
    const prefix = 'twinmcp_live_'
    const randomPart = this.generateRandomString(32)
    const apiKey = prefix + randomPart

    // Hasher la clé
    const saltRounds = 12
    const keyHash = await bcrypt.hash(apiKey, saltRounds)

    // Sauvegarder dans la base de données
    await this.db.apiKey.create({
      data: {
        userId,
        keyHash,
        keyPrefix: prefix + randomPart.slice(0, 12),
        name: name || `API Key ${new Date().toISOString()}`,
        tier: 'free',
        quotaDaily: 100,
        quotaMonthly: 3000
      }
    })

    return {
      apiKey,
      prefix: prefix + randomPart.slice(0, 12)
    }
  }

  async revokeApiKey(apiKeyId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.apiKey.updateMany({
        where: {
          id: apiKeyId,
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      })

      return result.count > 0
    } catch (error) {
      console.error('Error revoking API key:', error)
      return false
    }
  }

  async listUserApiKeys(userId: string) {
    const keys = await this.db.apiKey.findMany({
      where: {
        userId,
        revokedAt: null
      },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        tier: true,
        quotaDaily: true,
        quotaMonthly: true,
        lastUsedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return keys.map((key: typeof keys[number]) => ({
      ...key,
      quotaRequestsPerMinute: Math.max(1, Math.floor(key.quotaDaily / (24 * 60))),
      quotaRequestsPerDay: key.quotaDaily
    }))
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  async logUsage(apiKeyId: string, toolName: string, libraryId?: string, query?: string, tokensReturned?: number, responseTimeMs?: number) {
    try {
      const apiKeyRecord = await this.db.apiKey.findUnique({
        where: { id: apiKeyId },
        select: { usedDaily: true, usedMonthly: true, lastUsedAt: true, userId: true }
      })

      const now = new Date()
      const usedDaily = apiKeyRecord && this.isSameDay(apiKeyRecord.lastUsedAt, now)
        ? apiKeyRecord.usedDaily + 1
        : 1
      const usedMonthly = apiKeyRecord && this.isSameMonth(apiKeyRecord.lastUsedAt, now)
        ? apiKeyRecord.usedMonthly + 1
        : 1

      await this.db.$transaction([
        this.db.usageLog.create({
          data: {
            apiKeyId,
            userId: apiKeyRecord?.userId,
            toolName,
            libraryId,
            query,
            tokensReturned,
            responseTimeMs
          }
        }),
        this.db.apiKey.update({
          where: { id: apiKeyId },
          data: {
            usedDaily,
            usedMonthly,
            lastUsedAt: now
          }
        })
      ])
    } catch (error) {
      console.error('Error logging usage:', error)
    }
  }

  private isSameDay(date: Date | null | undefined, now: Date): boolean {
    if (!date) return false
    return date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
  }

  private isSameMonth(date: Date | null | undefined, now: Date): boolean {
    if (!date) return false
    return date.toISOString().slice(0, 7) === now.toISOString().slice(0, 7)
  }

  private getSecondsUntilEndOfDay(now: Date): number {
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    return Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000))
  }

  private getSecondsUntilEndOfMonth(now: Date): number {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return Math.max(1, Math.floor((endOfMonth.getTime() - now.getTime()) / 1000))
  }
}
