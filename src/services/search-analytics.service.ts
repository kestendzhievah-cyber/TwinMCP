import { Pool } from 'pg';
import { SearchResult } from '../types/search.types';

export class SearchAnalyticsService {
  constructor(private db: Pool) {}

  async logSearch(data: {
    query: string;
    userId?: string;
    resultCount: number;
    searchTime?: number;
    filters?: {
      tags?: string[];
      language?: string;
      license?: string;
    };
  }): Promise<void> {
    await this.db.query(`
      INSERT INTO search_logs (
        query, user_id, result_count, search_time, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      data.query,
      data.userId,
      data.resultCount,
      data.searchTime
    ]);
  }

  async logClick(libraryId: string, query: string, userId?: string): Promise<void> {
    await this.db.query(`
      INSERT INTO search_clicks (
        library_id, query, user_id, created_at
      ) VALUES ($1, $2, $3, NOW())
    `, [libraryId, query, userId]);

    // Mettre à jour le score de pertinence
    await this.updateRelevanceScore(libraryId, query);
  }

  private async updateRelevanceScore(libraryId: string, query: string): Promise<void> {
    // Augmenter le score de pertinence pour cette combinaison
    await this.db.query(`
      INSERT INTO search_relevance (library_id, query, score, last_updated)
      VALUES ($1, $2, 1.0, NOW())
      ON CONFLICT (library_id, query) 
      DO UPDATE SET 
        score = LEAST(search_relevance.score + 0.1, 1.0),
        last_updated = NOW()
    `, [libraryId, query]);
  }

  async getPopularQueries(limit: number = 10): Promise<Array<{ query: string; count: number }>> {
    const result = await this.db.query(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  async getZeroResultQueries(): Promise<Array<{ query: string; count: number }>> {
    const result = await this.db.query(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE result_count = 0 
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
    `);

    return result.rows;
  }

  async getSearchAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalSearches: number;
    uniqueQueries: number;
    averageResults: number;
    topQueries: Array<{ query: string; count: number }>;
    zeroResultQueries: Array<{ query: string; count: number }>;
  }> {
    const intervalMap = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const interval = intervalMap[timeframe];

    const [totalResult, uniqueResult, avgResult, topQueries, zeroResultQueries] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) as count
        FROM search_logs
        WHERE created_at > NOW() - INTERVAL '${interval}'
      `),
      this.db.query(`
        SELECT COUNT(DISTINCT query) as count
        FROM search_logs
        WHERE created_at > NOW() - INTERVAL '${interval}'
      `),
      this.db.query(`
        SELECT AVG(result_count) as avg
        FROM search_logs
        WHERE created_at > NOW() - INTERVAL '${interval}'
          AND result_count > 0
      `),
      this.db.query(`
        SELECT query, COUNT(*) as count
        FROM search_logs
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
      `),
      this.db.query(`
        SELECT query, COUNT(*) as count
        FROM search_logs
        WHERE result_count = 0 
          AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
      `)
    ]);

    return {
      totalSearches: parseInt(totalResult.rows[0].count),
      uniqueQueries: parseInt(uniqueResult.rows[0].count),
      averageResults: parseFloat(avgResult.rows[0].avg || '0'),
      topQueries: topQueries.rows,
      zeroResultQueries: zeroResultQueries.rows
    };
  }

  async getLibraryClickStats(libraryId: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalClicks: number;
    uniqueQueries: number;
    topQueries: Array<{ query: string; count: number }>;
    clickRate: number;
  }> {
    const intervalMap = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const interval = intervalMap[timeframe];

    const [clicksResult, queriesResult, topQueriesResult, searchesResult] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) as count
        FROM search_clicks
        WHERE library_id = $1
          AND created_at > NOW() - INTERVAL '${interval}'
      `, [libraryId]),
      this.db.query(`
        SELECT COUNT(DISTINCT query) as count
        FROM search_clicks
        WHERE library_id = $1
          AND created_at > NOW() - INTERVAL '${interval}'
      `, [libraryId]),
      this.db.query(`
        SELECT query, COUNT(*) as count
        FROM search_clicks
        WHERE library_id = $1
          AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
      `, [libraryId]),
      this.db.query(`
        SELECT COUNT(*) as count
        FROM search_logs
        WHERE query IN (
          SELECT DISTINCT query
          FROM search_clicks
          WHERE library_id = $1
            AND created_at > NOW() - INTERVAL '${interval}'
        )
          AND created_at > NOW() - INTERVAL '${interval}'
      `, [libraryId])
    ]);

    const totalClicks = parseInt(clicksResult.rows[0].count);
    const totalSearches = parseInt(searchesResult.rows[0].count);
    const clickRate = totalSearches > 0 ? totalClicks / totalSearches : 0;

    return {
      totalClicks,
      uniqueQueries: parseInt(queriesResult.rows[0].count),
      topQueries: topQueriesResult.rows,
      clickRate
    };
  }

  async getUserSearchHistory(userId: string, limit: number = 50): Promise<Array<{
    query: string;
    resultCount: number;
    clickedResult?: string;
    createdAt: Date;
  }>> {
    const result = await this.db.query(`
      SELECT query, result_count, clicked_result, created_at
      FROM search_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows;
  }

  async getRelevanceScores(query: string): Promise<Array<{
    libraryId: string;
    libraryName: string;
    score: number;
    lastUpdated: Date;
  }>> {
    const result = await this.db.query(`
      SELECT 
        sr.library_id,
        l.name as library_name,
        sr.score,
        sr.last_updated
      FROM search_relevance sr
      JOIN libraries l ON sr.library_id = l.id
      WHERE sr.query = $1
      ORDER BY sr.score DESC
    `, [query]);

    return result.rows;
  }

  async getUserSearchStats(userId: string): Promise<{
    totalSearches: number;
    averageResults: number;
    topQueries: Array<{ query: string; count: number }>;
    recentActivity: Array<{ query: string; resultCount: number; createdAt: Date }>;
  }> {
    const [totalResult, avgResult, topQueries, recentActivity] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) as count
        FROM search_logs
        WHERE user_id = $1
      `, [userId]),
      this.db.query(`
        SELECT AVG(result_count) as avg
        FROM search_logs
        WHERE user_id = $1
          AND result_count > 0
      `, [userId]),
      this.db.query(`
        SELECT query, COUNT(*) as count
        FROM search_logs
        WHERE user_id = $1
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
      `, [userId]),
      this.db.query(`
        SELECT query, result_count, created_at
        FROM search_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [userId])
    ]);

    return {
      totalSearches: parseInt(totalResult.rows[0].count),
      averageResults: parseFloat(avgResult.rows[0]?.avg || '0'),
      topQueries: topQueries.rows,
      recentActivity: recentActivity.rows
    };
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<void> {
    await this.db.query(`
      DELETE FROM search_logs
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `);
    await this.db.query(`
      DELETE FROM search_clicks
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `);
  }

  async logExport(data: {
    userId?: string;
    query: string;
    resultCount: number;
    format: string;
  }): Promise<void> {
    await this.db.query(`
      INSERT INTO export_logs (
        user_id, query, result_count, format, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      data.userId,
      data.query,
      data.resultCount,
      data.format
    ]);
  }
}
