import crypto from 'crypto';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ContextOptions {
  conversationId?: string;
  maxTokens?: number;
}

interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata: any;
  relevanceScore: number;
  tokens: number;
}

interface AssembledContext {
  content: string;
  items: ContextItem[];
  tokens: number;
  metadata: {
    itemCount: number;
    compressionRatio: number;
  };
}

export class ContextCacheService {
  private redis: Redis;
  private ttl = 3600;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  
  async get(
    query: string,
    options: ContextOptions
  ): Promise<AssembledContext | null> {
    const key = this.generateKey(query, options);
    const cached = await this.redis.get(key);
    
    if (cached) {
      const context = JSON.parse(cached);
      
      if (await this.isFresh(context)) {
        return context;
      }
    }
    
    return null;
  }
  
  async set(
    query: string,
    options: ContextOptions,
    context: AssembledContext
  ): Promise<void> {
    const key = this.generateKey(query, options);
    await this.redis.setex(key, this.ttl, JSON.stringify(context));
  }
  
  private generateKey(query: string, options: ContextOptions): string {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ query, options }))
      .digest('hex');
    return `context:${hash}`;
  }
  
  private async isFresh(context: AssembledContext): Promise<boolean> {
    for (const item of context.items) {
      const doc = await (prisma as any).crawledContent.findUnique({
        where: { id: item.id },
        select: { updatedAt: true }
      });
      
      if (doc && item.metadata.cachedAt && doc.updatedAt > new Date(item.metadata.cachedAt)) {
        return false;
      }
    }
    
    return true;
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`context:${pattern}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
