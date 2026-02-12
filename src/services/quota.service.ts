import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
  APIKey,
  QuotaCheckResult,
  UsageHistoryItem
} from '../types/api-key.types';

export class QuotaService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async checkQuota(apiKey: APIKey): Promise<QuotaCheckResult> {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
      const result = await this.db.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN date = $1 THEN requests_count ELSE 0 END), 0) as daily_used,
           COALESCE(SUM(CASE WHEN date LIKE $2 THEN requests_count ELSE 0 END), 0) as monthly_used
         FROM api_key_usage 
         WHERE key_id = $3`,
        [today, `${currentMonth}%`, apiKey.id]
      );

      const { daily_used, monthly_used } = result.rows[0];

      const dailyRemaining = Math.max(0, apiKey.quota_daily - daily_used);
      const monthlyRemaining = Math.max(0, apiKey.quota_monthly - monthly_used);

      const hasQuota = dailyRemaining > 0 && monthlyRemaining > 0;

      return {
        has_quota: hasQuota,
        daily_used: Number(daily_used),
        daily_limit: apiKey.quota_daily,
        daily_remaining: dailyRemaining,
        monthly_used: Number(monthly_used),
        monthly_limit: apiKey.quota_monthly,
        monthly_remaining: monthlyRemaining,
        reset_daily: this.getNextResetTime('daily'),
        reset_monthly: this.getNextResetTime('monthly')
      };

    } catch (error) {
      logger.error('Error checking quota:', error);
      throw new Error('Failed to check quota');
    }
  }

  async recordUsage(apiKey: APIKey, tokensUsed: number = 0): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    try {
      await this.db.query('BEGIN');

      await this.db.query(
        `UPDATE api_keys 
         SET last_used_at = $1, used_daily = used_daily + 1, used_monthly = used_monthly + 1
         WHERE id = $2`,
        [now, apiKey.id]
      );

      await this.recordDetailedUsage(apiKey.id, tokensUsed);

      await this.db.query('COMMIT');

      logger.debug('Usage recorded', {
        keyId: apiKey.id,
        tokensUsed,
        date: today
      });

    } catch (error) {
      await this.db.query('ROLLBACK');
      logger.error('Error recording usage:', error);
      throw new Error('Failed to record usage');
    }
  }

  async getUsageHistory(apiKeyId: string, period: 'daily' | 'monthly', limit: number = 30): Promise<UsageHistoryItem[]> {
    try {
      let query = `
        SELECT 
          date,
          requests_count,
          tokens_used,
          last_request_at
        FROM api_key_usage
        WHERE key_id = $1
      `;

      const params: any[] = [apiKeyId];

      if (period === 'daily') {
        query += ` AND date >= CURRENT_DATE - INTERVAL '${limit} days'`;
      } else {
        query += ` AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${Math.floor(limit/30)} months'`;
      }

      query += ` ORDER BY date DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error) {
      logger.error('Error getting usage history:', error);
      throw new Error('Failed to get usage history');
    }
  }

  async resetQuota(apiKeyId: string, type: 'daily' | 'monthly' | 'all'): Promise<void> {
    try {
      if (type === 'daily' || type === 'all') {
        await this.db.query(
          `UPDATE api_keys 
           SET used_daily = 0 
           WHERE id = $1`,
          [apiKeyId]
        );
      }

      if (type === 'monthly' || type === 'all') {
        await this.db.query(
          `UPDATE api_keys 
           SET used_monthly = 0 
           WHERE id = $1`,
          [apiKeyId]
        );
      }

      logger.info('Quota reset', { keyId: apiKeyId, type });

    } catch (error) {
      logger.error('Error resetting quota:', error);
      throw new Error('Failed to reset quota');
    }
  }

  async getQuotaStats(apiKeyId: string): Promise<{
    total_requests: number;
    total_tokens: number;
    average_daily_requests: number;
    peak_usage_day: { date: string; requests: number };
  }> {
    try {
      const result = await this.db.query(
        `SELECT 
           SUM(requests_count) as total_requests,
           SUM(tokens_used) as total_tokens,
           AVG(requests_count) as average_daily_requests,
           (SELECT date, requests_count 
            FROM api_key_usage 
            WHERE key_id = $1 
            ORDER BY requests_count DESC 
            LIMIT 1) as peak_usage_day
         FROM api_key_usage 
         WHERE key_id = $1`,
        [apiKeyId]
      );

      const stats = result.rows[0];

      return {
        total_requests: Number(stats.total_requests) || 0,
        total_tokens: Number(stats.total_tokens) || 0,
        average_daily_requests: Number(stats.average_daily_requests) || 0,
        peak_usage_day: stats.peak_usage_day || { date: '', requests: 0 }
      };

    } catch (error) {
      logger.error('Error getting quota stats:', error);
      throw new Error('Failed to get quota stats');
    }
  }

  private async recordDetailedUsage(apiKeyId: string, tokensUsed: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const query = `
      INSERT INTO api_key_usage (key_id, date, requests_count, tokens_used, last_request_at)
      VALUES ($1, $2, 1, $3, $4)
      ON CONFLICT (key_id, date)
      DO UPDATE SET
        requests_count = api_key_usage.requests_count + 1,
        tokens_used = api_key_usage.tokens_used + $3,
        last_request_at = $4
    `;

    await this.db.query(query, [apiKeyId, today, tokensUsed, now]);
  }

  private getNextResetTime(type: 'daily' | 'monthly'): Date {
    const now = new Date();
    
    if (type === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    } else {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }
  }
}
