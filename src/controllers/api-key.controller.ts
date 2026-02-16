import { Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}
import { APIKeyService } from '../services/api-key.service';
import { QuotaService } from '../services/quota.service';
import { logger } from '../utils/logger';
import {
  CreateAPIKeyData,
  APIKeyCreateRequest,
  APIKeyResponse,
  APIKeyCreateResponse,
  UsageStatsResponse
} from '../types/api-key.types';

export class APIKeyController {
  constructor(
    private apiKeyService: APIKeyService,
    private quotaService: QuotaService
  ) {}

  async createKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      const data = req.body as APIKeyCreateRequest;
      
      if (!data.name || !data.tier) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: name, tier'
        });
        return;
      }

      const createData: CreateAPIKeyData = {
        ...data,
        user_id: userId
      };

      const apiKey = await this.apiKeyService.createAPIKey(createData);
      
      const response: APIKeyCreateResponse = {
        id: apiKey.id,
        name: apiKey.name,
        tier: apiKey.tier,
        quota_daily: apiKey.quota_daily,
        quota_monthly: apiKey.quota_monthly,
        used_daily: apiKey.used_daily,
        used_monthly: apiKey.used_monthly,
        last_used_at: apiKey.last_used_at || undefined,
        expires_at: apiKey.expires_at || undefined,
        is_active: apiKey.is_active,
        permissions: apiKey.permissions,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
        api_key: apiKey.api_key
      };

      logger.info('API key created successfully', {
        keyId: apiKey.id,
        userId,
        tier: data.tier
      });

      res.status(201).json({
        success: true,
        api_key: response
      });
      
    } catch (error) {
      logger.error('Failed to create API key:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create API key'
      });
    }
  }

  async listKeys(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }
      
      const apiKeys = await this.apiKeyService.getAPIKeysByUser(userId);
      
      const response: APIKeyResponse[] = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        tier: key.tier,
        quota_daily: key.quota_daily,
        quota_monthly: key.quota_monthly,
        used_daily: key.used_daily,
        used_monthly: key.used_monthly,
        last_used_at: key.last_used_at || undefined,
        expires_at: key.expires_at || undefined,
        is_active: key.is_active,
        permissions: key.permissions,
        created_at: key.created_at,
        updated_at: key.updated_at
      }));

      res.json({
        success: true,
        api_keys: response
      });
      
    } catch (error) {
      logger.error('Failed to list API keys:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list API keys'
      });
    }
  }

  async getKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const keyId = req.params['key_id'] as string;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      if (!keyId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Key ID is required'
        });
        return;
      }
      
      const apiKey = await this.apiKeyService.getAPIKeyById(keyId, userId);
      
      if (!apiKey) {
        res.status(404).json({
          error: 'Not Found',
          message: 'API key not found'
        });
        return;
      }

      const response: APIKeyResponse = {
        id: apiKey.id,
        name: apiKey.name,
        tier: apiKey.tier,
        quota_daily: apiKey.quota_daily,
        quota_monthly: apiKey.quota_monthly,
        used_daily: apiKey.used_daily,
        used_monthly: apiKey.used_monthly,
        last_used_at: apiKey.last_used_at || undefined,
        expires_at: apiKey.expires_at || undefined,
        is_active: apiKey.is_active,
        permissions: apiKey.permissions,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at
      };

      res.json({
        success: true,
        api_key: response
      });
      
    } catch (error) {
      logger.error('Failed to get API key:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get API key'
      });
    }
  }

  async revokeKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const keyId = req.params['key_id'] as string;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      if (!keyId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Key ID is required'
        });
        return;
      }
      
      const success = await this.apiKeyService.revokeAPIKey(keyId, userId);
      
      if (success) {
        logger.info('API key revoked successfully', { keyId, userId });
        res.json({
          success: true,
          message: 'API key revoked successfully'
        });
      } else {
        res.status(404).json({
          error: 'Not Found',
          message: 'API key not found or access denied'
        });
      }
      
    } catch (error) {
      logger.error('Failed to revoke API key:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to revoke API key'
      });
    }
  }

  async regenerateKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const keyId = req.params['key_id'] as string;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      if (!keyId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Key ID is required'
        });
        return;
      }
      
      const newApiKey = await this.apiKeyService.regenerateAPIKey(keyId, userId);
      
      logger.info('API key regenerated successfully', { keyId, userId });
      
      res.json({
        success: true,
        message: 'API key regenerated successfully',
        api_key: newApiKey
      });
      
    } catch (error: any) {
      if (error.message === 'API key not found') {
        res.status(404).json({
          error: 'Not Found',
          message: 'API key not found or access denied'
        });
      } else {
        logger.error('Failed to regenerate API key:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to regenerate API key'
        });
      }
    }
  }

  async getKeyUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const keyId = req.params['key_id'] as string;
      const period = (req.query['period'] as 'daily' | 'monthly') || 'daily';
      const limit = parseInt((req.query['limit'] as string) || '30');

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      if (!keyId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Key ID is required'
        });
        return;
      }

      const apiKey = await this.apiKeyService.getAPIKeyById(keyId, userId);
      if (!apiKey) {
        res.status(404).json({
          error: 'Not Found',
          message: 'API key not found'
        });
        return;
      }
      
      const [quotaCheck, usageHistory] = await Promise.all([
        this.quotaService.checkQuota(apiKey),
        this.quotaService.getUsageHistory(keyId as string, period, limit)
      ]);

      const response: UsageStatsResponse = {
        daily_used: quotaCheck.daily_used,
        daily_limit: quotaCheck.daily_limit,
        daily_remaining: quotaCheck.daily_remaining,
        monthly_used: quotaCheck.monthly_used,
        monthly_limit: quotaCheck.monthly_limit,
        monthly_remaining: quotaCheck.monthly_remaining,
        reset_daily: quotaCheck.reset_daily,
        reset_monthly: quotaCheck.reset_monthly,
        usage_history: usageHistory
      };
      
      res.json({
        success: true,
        usage_stats: response
      });
      
    } catch (error) {
      logger.error('Failed to get API key usage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get usage history'
      });
    }
  }

  async updateKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const keyId = req.params['key_id'] as string;
      const updates = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      if (!keyId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Key ID is required'
        });
        return;
      }

      const success = await this.apiKeyService.updateAPIKey(keyId, userId, updates);
      
      if (success) {
        logger.info('API key updated successfully', { keyId, userId });
        res.json({
          success: true,
          message: 'API key updated successfully'
        });
      } else {
        res.status(404).json({
          error: 'Not Found',
          message: 'API key not found or no changes made'
        });
      }
      
    } catch (error) {
      logger.error('Failed to update API key:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update API key'
      });
    }
  }
}
