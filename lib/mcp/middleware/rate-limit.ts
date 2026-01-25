import { RateLimitConfig } from './auth-types'
import { canMakeRequest, recordApiRequest } from '@/lib/user-limits'

interface RateLimitStore {
  increment(windowMs: number): Promise<number>
  reset(key: string): Promise<void>
}

class MemoryRateLimitStore implements RateLimitStore {
  private data: Map<string, { count: number; resetTime: number }> = new Map()

  async increment(windowMs: number): Promise<number> {
    const now = Date.now()
    const resetTime = now + windowMs

    const existing = this.data.get('global') || { count: 0, resetTime }

    if (now > existing.resetTime) {
      existing.count = 1
      existing.resetTime = resetTime
    } else {
      existing.count++
    }

    this.data.set('global', existing)
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

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  current: number
}

export class RateLimiter {
  private stores: Map<string, RateLimitStore> = new Map()
  private memoryStore = new MemoryRateLimitStore()

  constructor() {
    // Nettoyage périodique
    setInterval(() => this.memoryStore.cleanup(), 60000)
  }

  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const store = this.getStore(key)
    const count = await store.increment(config.requests * 1000) // Convertir en millisecondes

    const windowMs = this.parseTimePeriod(config.period)
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
      memoryStoreSize: this.memoryStore['data']?.size || 0
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
    // Pour l'instant, on utilise le store mémoire
    // Plus tard, on pourrait implémenter Redis ou d'autres stores
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
