import { RateLimitConfig } from './auth-types'
import { canMakeRequest, recordApiRequest } from '@/lib/user-limits'

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>
  reset(key: string): Promise<void>
  cleanup(): void
}

class MemoryRateLimitStore implements RateLimitStore {
  private data: Map<string, { count: number; resetTime: number }> = new Map()

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const resetTime = now + windowMs

    const existing = this.data.get(key) || { count: 0, resetTime }

    if (now > existing.resetTime) {
      existing.count = 1
      existing.resetTime = resetTime
    } else {
      existing.count++
    }

    this.data.set(key, existing)
    return existing.count
  }

  async reset(key: string): Promise<void> {
    this.data.delete(key)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, data] of this.data) {
      if (now > data.resetTime) {
        this.data.delete(key)
      }
    }
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private redisClient: any
  private keyPrefix = 'mcp:ratelimit:'

  constructor(redisClient: any) {
    this.redisClient = redisClient
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const redisKey = this.keyPrefix + key
    const ttlSeconds = Math.ceil(windowMs / 1000)
    try {
      const count = await this.redisClient.incr(redisKey)
      if (count === 1) {
        await this.redisClient.expire(redisKey, ttlSeconds)
      }
      return count
    } catch (error) {
      console.error('[RateLimiter] Redis increment failed:', error)
      throw error
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.keyPrefix + key)
    } catch (error) {
      console.error('[RateLimiter] Redis reset failed:', error)
    }
  }

  cleanup(): void {
    // Redis handles TTL-based expiry automatically
  }
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  current: number
}

export class RateLimiter {
  private stores: Map<string, RateLimitStore> = new Map()
  private memoryStore = new MemoryRateLimitStore()
  private redisStore: RedisRateLimitStore | null = null
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.cleanupInterval = setInterval(() => this.memoryStore.cleanup(), 60000)
    this.initRedis()
  }

  private async initRedis(): Promise<void> {
    if (process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL) return
    try {
      const { redis } = await import('@/lib/redis')
      if (redis) {
        this.redisStore = new RedisRateLimitStore(redis)
        console.log('✅ RateLimiter: using Redis store (shared across instances)')
      }
    } catch {
      console.log('⚠️ RateLimiter: Redis unavailable, using memory store (per-instance)')
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.redisStore = null
  }

  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const store = this.getStore(key)
    const windowMs = this.parseTimePeriod(config.period)
    const count = await store.increment(key, windowMs)

    const resetAt = Date.now() + windowMs

    return {
      allowed: count <= config.requests,
      remaining: Math.max(0, config.requests - count),
      resetAt,
      current: count
    }
  }

  // Rate limit par utilisateur
  async checkUserLimit(
    userId: string,
    toolId: string,
    config: Partial<RateLimitConfig> = {}
  ): Promise<boolean> {
    const key = `user:${userId}:${toolId}`
    const defaultConfig: RateLimitConfig = {
      requests: 60,
      period: '1m',
      strategy: 'sliding',
      ...config
    }

    const result = await this.checkLimit(key, defaultConfig)
    return result.allowed
  }

  // Rate limit global par outil
  async checkGlobalLimit(toolId: string, maxRequests: number = 1000): Promise<boolean> {
    const key = `global:${toolId}`
    const result = await this.checkLimit(key, {
      requests: maxRequests,
      period: '1m',
      strategy: 'token-bucket'
    })

    return result.allowed
  }

  // Rate limit par IP
  async checkIPLimit(ip: string, maxRequests: number = 100): Promise<boolean> {
    const key = `ip:${ip}`
    const result = await this.checkLimit(key, {
      requests: maxRequests,
      period: '1m',
      strategy: 'sliding'
    })

    return result.allowed
  }

  // Vérifier les limites multiples
  async checkMultipleLimits(
    userId: string,
    toolId: string,
    ip: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Vérifier limite globale de l'outil
    const globalAllowed = await this.checkGlobalLimit(toolId)
    if (!globalAllowed) {
      return { allowed: false, reason: 'Global rate limit exceeded' }
    }

    // 2. Vérifier limite par utilisateur
    const userAllowed = await this.checkUserLimit(userId, toolId)
    if (!userAllowed) {
      return { allowed: false, reason: 'User rate limit exceeded' }
    }

    // 3. Vérifier limite par IP
    const ipAllowed = await this.checkIPLimit(ip)
    if (!ipAllowed) {
      return { allowed: false, reason: 'IP rate limit exceeded' }
    }

    return { allowed: true }
  }

  // Vérifier les limites basées sur le plan d'abonnement
  async checkPlanLimits(
    userId: string,
    endpoint: string
  ): Promise<{ allowed: boolean; reason?: string; limit?: number; current?: number; suggestedUpgrade?: string | null }> {
    try {
      const result = await canMakeRequest(userId)
      
      if (!result.allowed) {
        return {
          allowed: false,
          reason: `Limite quotidienne atteinte (${result.currentCount}/${result.limit} requêtes)`,
          limit: result.limit,
          current: result.currentCount,
          suggestedUpgrade: result.suggestedUpgrade
        }
      }

      // Enregistrer la requête pour le comptage
      await recordApiRequest(userId, endpoint)

      return { 
        allowed: true,
        limit: result.limit,
        current: result.currentCount
      }
    } catch (error) {
      console.error('Error checking plan limits:', error)
      // En cas d'erreur, on autorise par défaut pour ne pas bloquer
      return { allowed: true }
    }
  }

  // Obtenir les stats de rate limiting
  getStats() {
    return {
      activeStores: this.stores.size,
      memoryStoreSize: this.memoryStore['data']?.size || 0,
      backend: this.redisStore ? 'redis' : 'memory'
    }
  }

  // Reset rate limit pour une clé spécifique
  async resetLimit(key: string): Promise<void> {
    const store = this.stores.get(key)
    if (store) {
      await store.reset(key)
    } else {
      await this.memoryStore.reset(key)
    }
  }

  private getStore(key: string): RateLimitStore {
    // Use Redis when available for distributed rate limiting, fallback to memory
    if (this.redisStore) {
      return this.redisStore
    }
    return this.memoryStore
  }

  private parseTimePeriod(period: string): number {
    const unit = period.slice(-1)
    const value = parseInt(period.slice(0, -1))

    switch (unit) {
      case 's': return value * 1000
      case 'm': return value * 60 * 1000
      case 'h': return value * 60 * 60 * 1000
      case 'd': return value * 24 * 60 * 60 * 1000
      default: return 60 * 1000 // 1 minute par défaut
    }
  }
}

// Instance globale
export const rateLimiter = new RateLimiter()
