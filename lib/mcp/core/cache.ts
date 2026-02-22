import { CacheConfig } from './types'
import { logger } from '@/lib/logger'

interface CacheEntry {
  value: any
  timestamp: number
  ttl?: number
}

export class MCPCache {
  private memory: Map<string, CacheEntry> = new Map()
  private redis?: any // Redis client
  private config: CacheConfig
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private maxEntries: number

  constructor(config: CacheConfig, maxEntries: number = 10000) {
    this.config = config
    this.maxEntries = maxEntries
  }

  async initialize(): Promise<void> {
    const redisDisabled = process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL;
    
    if (!redisDisabled && (this.config.strategy === 'redis' || this.config.strategy === 'hybrid')) {
      try {
        const Redis = (await import('ioredis')).default
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        })

        this.redis.on('error', (err: Error) => {
          logger.error('Redis connection error:', err)
        })

        logger.info('Redis cache initialized')
      } catch (error) {
        logger.error('Failed to initialize Redis:', error)
        if (this.config.strategy === 'redis') {
          throw new Error('Redis is required but not available')
        }
      }
    } else if (redisDisabled) {
      logger.info('Redis disabled - using memory-only cache')
    }

    // Nettoyage périodique du cache mémoire
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000) // Nettoyer chaque minute
    if (this.cleanupInterval.unref) this.cleanupInterval.unref()
  }

  async get<T>(key: string): Promise<T | null> {
    // 1. Vérifier le cache mémoire
    const memoryHit = this.memory.get(key)
    if (memoryHit && !this.isExpired(memoryHit)) {
      return memoryHit.value as T
    }

    // 2. Vérifier le cache Redis si disponible
    if (this.redis && (this.config.strategy === 'redis' || this.config.strategy === 'hybrid')) {
      try {
        const redisData = await this.redis.get(key)
        if (redisData) {
          const parsed = JSON.parse(redisData)
          if (!this.isExpired(parsed)) {
            // Remettre en cache mémoire
            this.memory.set(key, parsed)
            return parsed.value as T
          } else {
            // Supprimer de Redis si expiré
            await this.redis.del(key)
          }
        }
      } catch (error) {
        logger.error('Redis get error:', error)
      }
    }

    return null
  }

  async set(key: string, value: any, customTtl?: number): Promise<void> {
    const ttl = customTtl || this.config.ttl
    const entry = {
      value,
      timestamp: Date.now(),
      ttl
    }

    // Evict oldest entries if at capacity (LRU: Map iteration order = insertion order)
    if (this.memory.size >= this.maxEntries) {
      const toEvict = this.memory.size - this.maxEntries + 1
      let evicted = 0
      for (const [k] of this.memory) {
        if (evicted >= toEvict) break
        this.memory.delete(k)
        evicted++
      }
    }

    // Cache mémoire (toujours)
    this.memory.set(key, entry)

    // Cache Redis si disponible
    if (this.redis && (this.config.strategy === 'redis' || this.config.strategy === 'hybrid')) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify(entry))
      } catch (error) {
        logger.error('Redis set error:', error)
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key)

    if (this.redis) {
      try {
        await this.redis.del(key)
      } catch (error) {
        logger.error('Redis delete error:', error)
      }
    }
  }

  async invalidate(pattern: string): Promise<void> {
    // Invalider les clés qui correspondent au pattern
    const regex = new RegExp(pattern.replace('*', '.*'))

    // Invalider du cache mémoire
    for (const [key] of this.memory) {
      if (regex.test(key)) {
        this.memory.delete(key)
      }
    }

    // Invalider de Redis si disponible
    if (this.redis) {
      try {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } catch (error) {
        logger.error('Redis invalidate error:', error)
      }
    }
  }

  async clear(): Promise<void> {
    this.memory.clear()

    if (this.redis) {
      try {
        await this.redis.flushdb()
      } catch (error) {
        logger.error('Redis clear error:', error)
      }
    }
  }

  getStats() {
    return {
      memorySize: this.memory.size,
      maxEntries: this.maxEntries,
      strategy: this.config.strategy,
      redisConnected: !!this.redis,
      utilizationPercent: Math.round((this.memory.size / this.maxEntries) * 100)
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) return false
    return Date.now() - entry.timestamp > entry.ttl * 1000
  }

  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.memory) {
      if (entry.ttl && now - entry.timestamp > entry.ttl * 1000) {
        this.memory.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache cleanup: ${cleaned} expired entries removed`)
    }
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    if (this.redis) {
      await this.redis.quit()
    }
    this.memory.clear()
  }
}

// Cache global
let globalCache: MCPCache | null = null

export function getCache(): MCPCache {
  if (!globalCache) {
    // Configuration par défaut
    globalCache = new MCPCache({
      enabled: true,
      ttl: 3600, // 1 heure
      key: (args: any) => JSON.stringify(args),
      strategy: 'memory' as const
    })
  }
  return globalCache
}

export async function initializeCache(): Promise<void> {
  const cache = getCache()
  await cache.initialize()
}

export async function closeCache(): Promise<void> {
  if (globalCache) {
    await globalCache.close()
    globalCache = null
  }
}
