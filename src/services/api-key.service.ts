import { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';
import { logger } from '../utils/logger';
import {
  APIKey,
  APIKeyValidationResult,
  CreateAPIKeyData,
  QuotaConfig
} from '../types/api-key.types';

export class APIKeyService {
  private db: Pool;
  private quotaConfig: QuotaConfig;

  constructor(db: Pool) {
    this.db = db;
    this.quotaConfig = {
      free: { daily: 100, monthly: 3000, rate_limit: 10 },
      basic: { daily: 1000, monthly: 30000, rate_limit: 60 },
      premium: { daily: 10000, monthly: 300000, rate_limit: 300 },
      enterprise: { daily: 100000, monthly: 3000000, rate_limit: 1000 }
    };
  }

  async validateAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
    try {
      if (!this.isValidAPIKeyFormat(apiKey)) {
        return {
          valid: false,
          error: 'INVALID_FORMAT',
          message: 'Invalid API key format'
        };
      }

      const keyHash = this.hashAPIKey(apiKey);

      const result = await this.db.query(
        `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true`,
        [keyHash]
      );

      if (result.rows.length === 0) {
        return {
          valid: false,
          error: 'NOT_FOUND',
          message: 'API key not found or inactive'
        };
      }

      const apiKeyData = result.rows[0];

      if (apiKeyData.expires_at && apiKeyData.expires_at < new Date()) {
        return {
          valid: false,
          error: 'EXPIRED',
          message: 'API key has expired'
        };
      }

      return {
        valid: true,
        apiKey: apiKeyData,
        fromCache: false
      };

    } catch (error) {
      logger.error('API key validation error:', error);
      return {
        valid: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal validation error'
      };
    }
  }

  async createAPIKey(data: CreateAPIKeyData): Promise<APIKey & { api_key: string }> {
    const apiKey = this.generateAPIKey();
    const keyHash = this.hashAPIKey(apiKey);

    const query = `
      INSERT INTO api_keys (
        name, key_hash, user_id, tier, quota_daily, quota_monthly,
        permissions, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.name,
      keyHash,
      data.user_id,
      data.tier,
      this.quotaConfig[data.tier].daily,
      this.quotaConfig[data.tier].monthly,
      JSON.stringify(data.permissions || []),
      data.expires_at || null,
      true
    ];

    const result = await this.db.query(query, values);
    const createdKey = result.rows[0];

    logger.info('API key created', {
      keyId: createdKey.id,
      userId: data.user_id,
      tier: data.tier
    });

    return {
      ...createdKey,
      api_key: apiKey
    };
  }

  async revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE api_keys 
       SET is_active = false, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    const success = (result.rowCount ?? 0) > 0;
    
    if (success) {
      logger.info('API key revoked', { keyId, userId });
    }

    return success;
  }

  async regenerateAPIKey(keyId: string, userId: string): Promise<string> {
    const existingKey = await this.db.query(
      'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );

    if (existingKey.rows.length === 0) {
      throw new Error('API key not found');
    }

    const newApiKey = this.generateAPIKey();
    const newKeyHash = this.hashAPIKey(newApiKey);

    await this.db.query(
      `UPDATE api_keys 
       SET key_hash = $1, updated_at = NOW() 
       WHERE id = $2`,
      [newKeyHash, keyId]
    );

    logger.info('API key regenerated', { keyId, userId });

    return newApiKey;
  }

  async getAPIKeysByUser(userId: string): Promise<APIKey[]> {
    const result = await this.db.query(
      `SELECT id, name, tier, quota_daily, quota_monthly, used_daily, used_monthly,
              last_used_at, expires_at, is_active, permissions, created_at, updated_at
       FROM api_keys 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getAPIKeyById(keyId: string, userId: string): Promise<APIKey | null> {
    const result = await this.db.query(
      `SELECT * FROM api_keys WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async updateAPIKey(keyId: string, userId: string, updates: Partial<APIKey>): Promise<boolean> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'created_at') continue;
      
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) return false;

    fields.push(`updated_at = NOW()`);
    values.push(keyId, userId);

    const query = `UPDATE api_keys SET ${fields.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`;
    
    const result = await this.db.query(query, values);
    
    return (result.rowCount ?? 0) > 0;
  }

  private isValidAPIKeyFormat(apiKey: string): boolean {
    const pattern = /^twinmcp_[a-zA-Z0-9]{32}$/;
    return pattern.test(apiKey);
  }

  private hashAPIKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private generateAPIKey(): string {
    const randomPart = randomBytes(16).toString('hex');
    return `twinmcp_${randomPart}`;
  }
}
