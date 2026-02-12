import { Redis } from 'ioredis';
import { Pool } from 'pg';
import {
  EmbeddingAnalytics,
  CostForecast,
  CacheStats
} from '../types/embeddings.types';
import {
  ANALYTICS_CONFIG,
  CACHE_KEYS
} from '../config/embeddings.config';

export class EmbeddingAnalyticsService {
  constructor(
    private redis: Redis,
    private db: Pool
  ) {}

  async getEmbeddingStats(timeRange: 'hour' | 'day' | 'week'): Promise<EmbeddingAnalytics> {
    const timeMap = {
      hour: 3600,
      day: 86400,
      week: 604800
    };
    
    const cutoff = Date.now() - (timeMap[timeRange] * 1000);
    
    const stats = await this.redis.lrange(CACHE_KEYS.embeddingStats, 0, -1);
    const filteredStats = stats
      .map(s => JSON.parse(s))
      .filter(s => new Date(s.timestamp).getTime() > cutoff);
    
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

  async getCostForecast(days: number = 30): Promise<CostForecast> {
    const weekStats = await this.getEmbeddingStats('week');
    
    const dailyAverage = {
      tokens: weekStats.totalTokens / 7,
      cost: weekStats.totalCost / 7
    };
    
    const forecast = {
      estimatedCost: dailyAverage.cost * days,
      estimatedTokens: Math.floor(dailyAverage.tokens * days),
      recommendations: this.generateCostRecommendations(weekStats)
    };
    
    return forecast;
  }

  async getLibraryAnalytics(libraryId: string): Promise<{
    totalChunks: number;
    indexedChunks: number;
    indexingPercentage: number;
    totalCost: number;
    totalTokens: number;
    lastIndexed: Date | null;
  }> {
    const result = await this.db.query(`
      SELECT * FROM library_embedding_stats 
      WHERE library_id = $1
    `, [libraryId]);
    
    if (result.rows.length === 0) {
      return {
        totalChunks: 0,
        indexedChunks: 0,
        indexingPercentage: 0,
        totalCost: 0,
        totalTokens: 0,
        lastIndexed: null
      };
    }
    
    const row = result.rows[0];
    if (!row) {
      throw new Error('Library stats not found');
    }
    return {
      totalChunks: row.total_chunks,
      indexedChunks: row.indexed_chunks,
      indexingPercentage: row.indexing_percentage,
      totalCost: row.total_cost || 0,
      totalTokens: row.total_tokens || 0,
      lastIndexed: row.last_indexed ? new Date(row.last_indexed) : null
    };
  }

  async getModelPerformanceStats(): Promise<Array<{
    model: string;
    totalGenerations: number;
    totalChunks: number;
    totalTokens: number;
    totalCost: number;
    avgProcessingTime: number;
    avgCacheHitRate: number;
    avgErrorRate: number;
  }>> {
    const result = await this.db.query(`
      SELECT * FROM model_performance_stats
      ORDER BY total_cost DESC
    `);
    
    return result.rows;
  }

  async updateCacheStats(model: string, hitRate: number, errorRate: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    if (!today) {
      throw new Error('Unable to generate current date');
    }
    
    const cacheKey = CACHE_KEYS.stats('day');
    
    await this.redis.hincrby(cacheKey, 'totalRequests', 1);
    
    if (hitRate > 0) {
      await this.redis.hincrby(cacheKey, 'cacheHits', 1);
    } else {
      await this.redis.hincrby(cacheKey, 'cacheMisses', 1);
    }
    
    const stats = await this.redis.hgetall(cacheKey);
    const totalRequests = parseInt(stats['totalRequests'] || '0');
    const cacheHits = parseInt(stats['cacheHits'] || '0');
    
    const newHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;
    await this.redis.hset(cacheKey, 'hitRate', newHitRate.toString());
    await this.redis.hset(cacheKey, 'errorRate', errorRate.toString());
    await this.redis.expire(cacheKey, 86400);
    
    await this.updateDatabaseCacheStats(today, model, hitRate);
  }

  async getCostAlerts(): Promise<Array<{
    type: 'daily_cost' | 'weekly_cost' | 'monthly_cost' | 'error_rate' | 'cache_hit_rate';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value: number;
    threshold: number;
    timestamp: Date;
  }>> {
    const alerts: Array<{
      type: 'daily_cost' | 'weekly_cost' | 'monthly_cost' | 'error_rate' | 'cache_hit_rate';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      value: number;
      threshold: number;
      timestamp: Date;
    }> = [];
    
    const now = new Date();
    
    const dayStats = await this.getEmbeddingStats('day');
    
    if (dayStats.totalCost > ANALYTICS_CONFIG.costAlertThreshold) {
      alerts.push({
        type: 'daily_cost' as const,
        severity: dayStats.totalCost > 50 ? 'critical' as const : 'high' as const,
        message: `Daily cost $${dayStats.totalCost.toFixed(2)} exceeds threshold`,
        value: dayStats.totalCost,
        threshold: ANALYTICS_CONFIG.costAlertThreshold,
        timestamp: now
      });
    }
    
    if (dayStats.errorRate > ANALYTICS_CONFIG.errorRateThreshold) {
      alerts.push({
        type: 'error_rate' as const,
        severity: dayStats.errorRate > 0.1 ? 'critical' as const : 'medium' as const,
        message: `Error rate ${(dayStats.errorRate * 100).toFixed(2)}% exceeds threshold`,
        value: dayStats.errorRate,
        threshold: ANALYTICS_CONFIG.errorRateThreshold,
        timestamp: now
      });
    }
    
    if (dayStats.cacheHitRate < ANALYTICS_CONFIG.cacheHitRateThreshold) {
      alerts.push({
        type: 'cache_hit_rate' as const,
        severity: dayStats.cacheHitRate < 0.3 ? 'high' as const : 'medium' as const,
        message: `Cache hit rate ${(dayStats.cacheHitRate * 100).toFixed(2)}% below threshold`,
        value: dayStats.cacheHitRate,
        threshold: ANALYTICS_CONFIG.cacheHitRateThreshold,
        timestamp: now
      });
    }
    
    return alerts;
  }

  async exportAnalyticsReport(timeRange: 'hour' | 'day' | 'week', format: 'json' | 'csv' = 'json'): Promise<string> {
    const stats = await this.getEmbeddingStats(timeRange);
    const modelStats = await this.getModelPerformanceStats();
    const costForecast = await this.getCostForecast(30);
    const alerts = await this.getCostAlerts();
    
    const report = {
      generatedAt: new Date().toISOString(),
      timeRange,
      summary: stats,
      modelPerformance: modelStats,
      costForecast,
      alerts,
      recommendations: this.generateCostRecommendations(stats)
    };
    
    if (format === 'csv') {
      return this.convertToCSV(report);
    }
    
    return JSON.stringify(report, null, 2);
  }

  private async getCacheStats(timeRange: string): Promise<CacheStats> {
    const cacheKey = CACHE_KEYS.stats(timeRange);
    const cached = await this.redis.hgetall(cacheKey);
    
    const totalRequests = parseInt(cached['totalRequests'] || '0');
    const cacheHits = parseInt(cached['cacheHits'] || '0');
    const cacheMisses = parseInt(cached['cacheMisses'] || '0');
    
    return {
      hitRate: parseFloat(cached['hitRate'] || '0'),
      errorRate: parseFloat(cached['errorRate'] || '0'),
      totalRequests,
      cacheHits,
      cacheMisses
    };
  }

  private async updateDatabaseCacheStats(date: string, model: string, hitRate: number): Promise<void> {
    await this.db.query(`
      INSERT INTO cache_statistics (date, model, total_requests, cache_hits, cache_misses, hit_rate)
      VALUES ($1, $2, 1, CASE WHEN $3 > 0 THEN 1 ELSE 0 END, CASE WHEN $3 = 0 THEN 1 ELSE 0 END, $3)
      ON CONFLICT (date, model) 
      DO UPDATE SET 
        total_requests = cache_statistics.total_requests + 1,
        cache_hits = cache_statistics.cache_hits + CASE WHEN $3 > 0 THEN 1 ELSE 0 END,
        cache_misses = cache_statistics.cache_misses + CASE WHEN $3 = 0 THEN 1 ELSE 0 END,
        hit_rate = (cache_statistics.cache_hits + CASE WHEN $3 > 0 THEN 1 ELSE 0 END)::DECIMAL / (cache_statistics.total_requests + 1),
        updated_at = NOW()
    `, [date, model, hitRate]);
  }

  private generateCostRecommendations(stats: EmbeddingAnalytics): string[] {
    const recommendations: string[] = [];
    
    if (stats.totalCost > 10) {
      recommendations.push('Consider using text-embedding-3-small model to reduce costs');
    }
    
    if (stats.cacheHitRate < 0.5) {
      recommendations.push('Increase cache TTL to improve hit rate');
    }
    
    if (stats.modelUsage['text-embedding-3-large'] && 
        stats.modelUsage['text-embedding-3-large'] / stats.totalChunks > 0.3) {
      recommendations.push('Reserve large model usage for critical content only');
    }
    
    if (stats.averageProcessingTime > ANALYTICS_CONFIG.performanceAlertThreshold) {
      recommendations.push('Optimize batch sizes or consider async processing');
    }
    
    if (stats.errorRate > ANALYTICS_CONFIG.errorRateThreshold) {
      recommendations.push('Review error logs and implement better error handling');
    }
    
    return recommendations;
  }

  private convertToCSV(report: any): string {
    const headers = ['Metric', 'Value', 'Unit'];
    const rows = [
      ['Total Chunks', report.summary.totalChunks.toString(), 'count'],
      ['Total Tokens', report.summary.totalTokens.toString(), 'tokens'],
      ['Total Cost', report.summary.totalCost.toFixed(4), 'USD'],
      ['Avg Processing Time', report.summary.averageProcessingTime.toFixed(2), 'ms'],
      ['Cache Hit Rate', (report.summary.cacheHitRate * 100).toFixed(2), '%'],
      ['Error Rate', (report.summary.errorRate * 100).toFixed(2), '%']
    ];
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    return csvContent;
  }

  async cleanupOldStats(daysToKeep: number = ANALYTICS_CONFIG.statsRetentionDays): Promise<number> {
    const result = await this.db.query(`
      SELECT cleanup_old_embedding_stats($1) as deleted_count
    `, [daysToKeep]);
    
    return result.rows[0].deleted_count;
  }
}
