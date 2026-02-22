import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import {
  EmbeddingRequest,
  EmbeddingResult,
  EmbeddingGenerationConfig,
  BatchProcessingStats,
  DocumentChunk
} from '../types/embeddings.types';
import {
  EMBEDDING_MODELS,
  BATCH_SIZE_LIMIT,
  MAX_CONTENT_LENGTH,
  EMBEDDING_CACHE_TTL,
  RATE_LIMITS,
  EMBEDDING_CONFIG,
  CACHE_KEYS
} from '../config/embeddings.config';

export class EmbeddingGenerationService {
  private openai: OpenAI;
  private rateLimiter: Map<string, number[]> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private config: EmbeddingGenerationConfig
  ) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
      maxRetries: config.maxRetries,
    });
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResult[]> {
    const model = request.model || this.config.defaultModel;
    const batchSize = Math.min(request.batchSize || BATCH_SIZE_LIMIT, BATCH_SIZE_LIMIT);
    
    const validChunks = this.validateAndPrepareChunks(request.chunks);
    
    const cachedResults = await this.checkCache(validChunks, model);
    const uncachedChunks = validChunks.filter(chunk => !cachedResults.has(chunk.id));
    
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < uncachedChunks.length; i += batchSize) {
      const batch = uncachedChunks.slice(i, i + batchSize);
      
      try {
        const batchResults = await this.processBatch(batch, model);
        results.push(...batchResults);
        
        await this.cacheResults(batchResults);
        
        if (i + batchSize < uncachedChunks.length) {
          await this.delay(100);
        }
        
      } catch (error) {
        logger.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
      }
    }
    
    results.push(...Array.from(cachedResults.values()));
    
    await this.logEmbeddingStats(results, model);
    
    return results;
  }

  private validateAndPrepareChunks(chunks: EmbeddingRequest['chunks']): EmbeddingRequest['chunks'] {
    return chunks.filter(chunk => {
      if (chunk.content.length > MAX_CONTENT_LENGTH) {
        logger.warn(`Chunk ${chunk.id} too long (${chunk.content.length} chars), truncating`);
        chunk.content = chunk.content.substring(0, MAX_CONTENT_LENGTH);
      }
      
      if (!chunk.content.trim()) {
        logger.warn(`Chunk ${chunk.id} is empty, skipping`);
        return false;
      }
      
      return true;
    });
  }

  private async checkCache(
    chunks: EmbeddingRequest['chunks'], 
    model: string
  ): Promise<Map<string, EmbeddingResult>> {
    const cached = new Map<string, EmbeddingResult>();
    
    for (const chunk of chunks) {
      const cacheKey = CACHE_KEYS.embedding(chunk.content, model);
      const cachedResult = await this.redis.get(cacheKey);
      
      if (cachedResult) {
        const result = JSON.parse(cachedResult);
        cached.set(chunk.id, result);
      }
    }
    
    return cached;
  }

  private async processBatch(
    batch: EmbeddingRequest['chunks'], 
    model: string
  ): Promise<EmbeddingResult[]> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit(model);
      
      const modelConfig = EMBEDDING_MODELS[model];
      const embeddingParams: any = {
        model,
        input: batch.map(chunk => chunk.content),
        encoding_format: 'float'
      };
      
      if (modelConfig?.dimensions) {
        embeddingParams.dimensions = modelConfig.dimensions;
      }
      
      const response = await this.openai.embeddings.create(embeddingParams);
      
      const processingTime = Date.now() - startTime;
      
      return response.data.map((embedding, index) => {
        const chunk = batch[index];
        if (!chunk) {
          throw new Error(`Chunk at index ${index} is undefined`);
        }
        const tokens = this.countTokens(chunk.content);
        const cost = this.calculateCost(tokens, model);
        
        return {
          chunkId: chunk.id,
          embedding: embedding.embedding,
          model,
          tokens,
          cost,
          processingTime: processingTime / batch.length
        };
      });
      
    } catch (error) {
      logger.error('OpenAI API error:', error);
      
      if (error instanceof Error && error.message.includes('rate limit')) {
        await this.delay(this.config.retryDelay);
        return this.processBatch(batch, model);
      }
      
      throw error;
    }
  }

  private async cacheResults(results: EmbeddingResult[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const result of results) {
      const chunk = await this.getChunkById(result.chunkId);
      if (chunk) {
        const cacheKey = CACHE_KEYS.embedding(chunk.content, result.model);
        pipeline.setex(cacheKey, EMBEDDING_CACHE_TTL, JSON.stringify(result));
      }
    }
    
    await pipeline.exec();
  }

  private async checkRateLimit(model: string): Promise<void> {
    const key = CACHE_KEYS.rateLimit(model);
    const now = Date.now();
    const window = EMBEDDING_CONFIG.rateLimitWindow;
    const limit = RATE_LIMITS[model] || EMBEDDING_CONFIG.defaultRateLimit;
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, []);
    }
    
    const requests = this.rateLimiter.get(key)!;
    const validRequests = requests.filter(timestamp => now - timestamp < window);
    this.rateLimiter.set(key, validRequests);
    
    if (validRequests.length >= limit) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = oldestRequest + window - now;
      
      if (waitTime > 0) {
        logger.info(`Rate limit reached for ${model}, waiting ${waitTime}ms`);
        await this.delay(waitTime);
      }
    }
    
    validRequests.push(now);
  }

  private countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private calculateCost(tokens: number, model: string): number {
    const modelConfig = EMBEDDING_MODELS[model];
    if (!modelConfig) return 0;
    
    return (tokens / 1000) * modelConfig.costPer1KTokens;
  }

  private async logEmbeddingStats(results: EmbeddingResult[], model: string): Promise<void> {
    const stats: BatchProcessingStats = {
      model,
      chunksProcessed: results.length,
      totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
      totalCost: results.reduce((sum, r) => sum + r.cost, 0),
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      timestamp: new Date()
    };
    
    await this.redis.lpush(CACHE_KEYS.embeddingStats, JSON.stringify(stats));
    await this.redis.ltrim(CACHE_KEYS.embeddingStats, 0, 999);
  }

  private async getChunkById(chunkId: string): Promise<DocumentChunk | null> {
    const result = await this.db.query(
      'SELECT content FROM document_chunks WHERE id = $1',
      [chunkId]
    );
    
    return result.rows[0] || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getEmbeddingStats(timeRange: 'hour' | 'day' | 'week'): Promise<{
    totalChunks: number;
    totalTokens: number;
    totalCost: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    modelUsage: Record<string, number>;
    errorRate: number;
  }> {
    const timeMap = {
      hour: 3600,
      day: 86400,
      week: 604800
    };
    
    const cutoff = Date.now() - (timeMap[timeRange] * 1000);
    
    const stats = await this.redis.lrange(CACHE_KEYS.embeddingStats, 0, -1);
    const filteredStats = stats
      .map(s => JSON.parse(s))
      .filter((s: BatchProcessingStats) => new Date(s.timestamp).getTime() > cutoff);
    
    if (filteredStats.length === 0) {
      return {
        totalChunks: 0,
        totalTokens: 0,
        totalCost: 0,
        averageProcessingTime: 0,
        cacheHitRate: 0,
        modelUsage: {},
        errorRate: 0
      };
    }
    
    const totalChunks = filteredStats.reduce((sum, s) => sum + s.chunksProcessed, 0);
    const totalTokens = filteredStats.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalCost = filteredStats.reduce((sum, s) => sum + s.totalCost, 0);
    const avgProcessingTime = filteredStats.reduce((sum, s) => sum + s.averageProcessingTime, 0) / filteredStats.length;
    
    const modelUsage = filteredStats.reduce((acc, s) => {
      acc[s.model] = (acc[s.model] || 0) + s.chunksProcessed;
      return acc;
    }, {} as Record<string, number>);
    
    const cacheStats = await this.getCacheStats(timeRange);
    
    return {
      totalChunks,
      totalTokens,
      totalCost,
      averageProcessingTime: avgProcessingTime,
      cacheHitRate: cacheStats.hitRate,
      modelUsage,
      errorRate: cacheStats.errorRate
    };
  }

  private async getCacheStats(timeRange: string): Promise<{ hitRate: number; errorRate: number }> {
    const cacheKey = CACHE_KEYS.stats(timeRange);
    const cached = await this.redis.hgetall(cacheKey);
    
    return {
      hitRate: parseFloat(cached['hitRate'] || '0'),
      errorRate: parseFloat(cached['errorRate'] || '0')
    };
  }
}
