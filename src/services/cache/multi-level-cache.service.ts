import Redis from 'ioredis';

const REDIS_DISABLED =
  process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL;

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl?: number;
}

interface CacheOptions {
  ttl?: number;
  cdn?: boolean;
}

export class MultiLevelCacheService {
  private l1Cache: Map<string, CacheEntry>;
  private l2Cache: Redis | null;
  
  constructor() {
    this.l1Cache = new Map();
    if (REDIS_DISABLED) {
      this.l2Cache = null;
    } else {
      this.l2Cache = new Redis(process.env.REDIS_URL!);
      this.l2Cache.on('error', (err: Error) => {
        console.error('[multi-level-cache] Redis error:', err.message);
      });
    }
    this.setupL1Eviction();
  }
  
  async get<T>(key: string): Promise<T | null> {
    const l1 = this.l1Cache.get(key);
    if (l1 && !this.isExpired(l1)) {
      return l1.value as T;
    }
    
    if (this.l2Cache) {
      const l2 = await this.l2Cache.get(key);
      if (l2) {
        const value = JSON.parse(l2);
        this.l1Cache.set(key, { value, timestamp: Date.now() });
        return value as T;
      }
    }
    
    if (this.isStaticContent(key)) {
      const l3 = await this.fetchFromCDN(key);
      if (l3) {
        await this.set(key, l3, { ttl: 86400 });
        return l3 as T;
      }
    }
    
    return null;
  }
  
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 3600;
    
    if (this.l1Cache.size < 1000) {
      this.l1Cache.set(key, { value, timestamp: Date.now(), ttl });
    }
    
    if (this.l2Cache) {
      await this.l2Cache.setex(key, ttl, JSON.stringify(value));
    }
    
    if (this.isStaticContent(key) && options.cdn) {
      await this.uploadToCDN(key, value);
    }
  }
  
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    if (this.l2Cache) await this.l2Cache.del(key);
  }
  
  async clear(): Promise<void> {
    this.l1Cache.clear();
    if (this.l2Cache) await this.l2Cache.flushdb();
  }
  
  private setupL1Eviction() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.l1Cache) {
        if (this.isExpired(entry)) {
          this.l1Cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
  
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl * 1000;
  }
  
  private isStaticContent(key: string): boolean {
    return key.startsWith('static:') || key.includes('.css') || key.includes('.js');
  }
  
  private async fetchFromCDN(key: string): Promise<any> {
    return null;
  }
  
  private async uploadToCDN(key: string, value: any): Promise<void> {
  }
  
  async close(): Promise<void> {
    if (this.l2Cache) await this.l2Cache.quit();
  }
}
