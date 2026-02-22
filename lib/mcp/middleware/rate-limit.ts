import { RateLimitConfig } from './auth-types'
import { logger } from '@/lib/logger'

// Lazy-loaded to avoid Firebase initialization in test environments
let _userLimits: typeof import('@/lib/user-limits') | null = null
async function getUserLimitsModule() {
  if (!_userLimits) {
    _userLimits = await import('@/lib/user-limits')
  }
  return _userLimits
}

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
      logger.error('[RateLimiter] Redis increment failed:', error)
      throw error
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.keyPrefix + key)
    } catch (error) {
      logger.error('[RateLimiter] Redis reset failed:', error)
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

/**
 * Token Bucket for advanced burst handling.
 * Tokens refill at a steady rate; bursts are allowed up to `burstCapacity`.
 */
interface TokenBucket {
  tokens: number
  lastRefill: number
}

export interface BurstConfig {
  /** Sustained requests per second */
  rate: number
  /** Maximum burst size (tokens) */
  burstCapacity: number
}

class TokenBucketStore {
  private buckets: Map<string, TokenBucket> = new Map()

  consume(key: string, config: BurstConfig): { allowed: boolean; tokens: number } {
    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket) {
      bucket = { tokens: config.burstCapacity, lastRefill: now }
      this.buckets.set(key, bucket)
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000
    bucket.tokens = Math.min(
      config.burstCapacity,
      bucket.tokens + elapsed * config.rate
    )
    bucket.lastRefill = now

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true, tokens: Math.floor(bucket.tokens) }
    }

    return { allowed: false, tokens: 0 }
  }

  getTokens(key: string, config: BurstConfig): number {
    const bucket = this.buckets.get(key)
    if (!bucket) return config.burstCapacity
    const elapsed = (Date.now() - bucket.lastRefill) / 1000
    return Math.min(config.burstCapacity, Math.floor(bucket.tokens + elapsed * config.rate))
  }

  cleanup(): void {
    const now = Date.now()
    const staleMs = 300_000 // 5 min
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > staleMs) {
        this.buckets.delete(key)
      }
    }
  }

  get size(): number {
    return this.buckets.size
  }
}

export class RateLimiter {
  private stores: Map<string, RateLimitStore> = new Map()
  private memoryStore = new MemoryRateLimitStore()
  private redisStore: RedisRateLimitStore | null = null
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private burstStore = new TokenBucketStore()

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.memoryStore.cleanup()
      this.burstStore.cleanup()
    }, 60000)
    if (this.cleanupInterval.unref) this.cleanupInterval.unref()
    this.initRedis()
  }

  private async initRedis(): Promise<void> {
    if (process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL) return
    try {
      const { redis } = await import('@/lib/redis')
      if (redis) {
        this.redisStore = new RedisRateLimitStore(redis)
        logger.info('RateLimiter: using Redis store (shared across instances)')
      }
    } catch {
      logger.info('RateLimiter: Redis unavailable, using memory store (per-instance)')
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
      const userLimits = await getUserLimitsModule()
      const result = await userLimits.canMakeRequest(userId)
      
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
      await userLimits.recordApiRequest(userId, endpoint)

      return { 
        allowed: true,
        limit: result.limit,
        current: result.currentCount
      }
    } catch (error) {
      logger.error('Error checking plan limits:', error)
      // En cas d'erreur, on autorise par défaut pour ne pas bloquer
      return { allowed: true }
    }
  }

  // Burst-aware rate limiting (token bucket)
  async checkBurstLimit(
    key: string,
    config: BurstConfig
  ): Promise<{ allowed: boolean; tokensRemaining: number }> {
    const result = this.burstStore.consume(key, config)
    return { allowed: result.allowed, tokensRemaining: result.tokens }
  }

  // Burst + sustained combined check
  async checkCombinedLimit(
    key: string,
    sustainedConfig: RateLimitConfig,
    burstConfig: BurstConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Check burst (short-term)
    const burst = this.burstStore.consume(key, burstConfig)
    if (!burst.allowed) {
      return { allowed: false, reason: 'Burst limit exceeded' }
    }

    // 2. Check sustained (long-term window)
    const sustained = await this.checkLimit(`sustained:${key}`, sustainedConfig)
    if (!sustained.allowed) {
      return { allowed: false, reason: 'Sustained rate limit exceeded' }
    }

    return { allowed: true }
  }

  // Obtenir les stats de rate limiting
  getStats() {
    return {
      activeStores: this.stores.size,
      memoryStoreSize: this.memoryStore['data']?.size || 0,
      burstBuckets: this.burstStore.size,
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

// Lazy-init singleton — avoids starting setInterval + Redis connection at import time
let _rateLimiter: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!_rateLimiter) {
    _rateLimiter = new RateLimiter()
  }
  return _rateLimiter
}

// Backward-compatible named export via getter proxy
export const rateLimiter: RateLimiter = new Proxy({} as RateLimiter, {
  get(_target, prop, receiver) {
    return Reflect.get(getRateLimiter(), prop, receiver)
  }
})
