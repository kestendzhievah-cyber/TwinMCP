import { Pool } from 'pg';

export class LibraryAnalyticsService {
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

  async getLibraryAnalytics(libraryId: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalSearches: number;
    totalClicks: number;
    clickRate: number;
    topQueries: Array<{ query: string; count: number }>;
    trending: boolean;
  }> {
    const intervalMap = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const interval = intervalMap[timeframe];

    const [searchesResult, clicksResult, topQueriesResult] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*) as count
        FROM search_logs
        WHERE clicked_result = $1
          AND created_at > NOW() - INTERVAL '${interval}'
      `, [libraryId]),
      this.db.query(`
        SELECT COUNT(*) as count
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
        LIMIT 5
      `, [libraryId])
    ]);

    const totalSearches = parseInt(searchesResult.rows[0].count);
    const totalClicks = parseInt(clicksResult.rows[0].count);
    const clickRate = totalSearches > 0 ? totalClicks / totalSearches : 0;

    // Déterminer si la bibliothèque est tendance
    const trendingResult = await this.db.query(`
      SELECT 
        COUNT(*) as recent_clicks,
        LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('day', created_at)) as previous_clicks
      FROM search_clicks
      WHERE library_id = $1
        AND created_at > NOW() - INTERVAL '14 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at) DESC
      LIMIT 1
    `, [libraryId]);

    const recentClicks = parseInt(trendingResult.rows[0]?.recent_clicks || '0');
    const previousClicks = parseInt(trendingResult.rows[0]?.previous_clicks || '0');
    const trending = recentClicks > previousClicks * 1.2; // 20% d'augmentation

    return {
      totalSearches,
      totalClicks,
      clickRate,
      topQueries: topQueriesResult.rows,
      trending
    };
  }

  async getPopularLibraries(limit: number = 10, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<Array<{
    libraryId: string;
    libraryName: string;
    searches: number;
    clicks: number;
    clickRate: number;
  }>> {
    const intervalMap = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const interval = intervalMap[timeframe];

    const result = await this.db.query(`
      SELECT 
        l.id as library_id,
        l.name as library_name,
        COUNT(DISTINCT sl.id) as searches,
        COUNT(DISTINCT sc.id) as clicks,
        CASE 
          WHEN COUNT(DISTINCT sl.id) > 0 
          THEN COUNT(DISTINCT sc.id)::float / COUNT(DISTINCT sl.id)
          ELSE 0 
        END as click_rate
      FROM libraries l
      LEFT JOIN search_logs sl ON l.id = sl.clicked_result
        AND sl.created_at > NOW() - INTERVAL '${interval}'
      LEFT JOIN search_clicks sc ON l.id = sc.library_id
        AND sc.created_at > NOW() - INTERVAL '${interval}'
      GROUP BY l.id, l.name
      HAVING COUNT(DISTINCT sl.id) > 0 OR COUNT(DISTINCT sc.id) > 0
      ORDER BY searches DESC, clicks DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      libraryId: row.library_id,
      libraryName: row.library_name,
      searches: parseInt(row.searches),
      clicks: parseInt(row.clicks),
      clickRate: parseFloat(row.click_rate)
    }));
  }
}
