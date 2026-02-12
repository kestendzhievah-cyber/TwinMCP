import { Request, Response, NextFunction } from 'express';
import { APIKeyService } from '../services/api-key.service';
import { QuotaService } from '../services/quota.service';
import { logger } from '../utils/logger';
import { APIKey, QuotaCheckResult } from '../types/api-key.types';

declare global {
  namespace Express {
    interface Request {
      apiKey?: APIKey;
      quotaInfo?: QuotaCheckResult;
    }
  }
}

export class APIKeyTrackingMiddleware {
  constructor(
    private apiKeyService: APIKeyService,
    private quotaService: QuotaService
  ) {}

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        const apiKey = this.extractAPIKey(req);
        
        if (!apiKey) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'API key required'
          });
          return;
        }

        const validation = await this.apiKeyService.validateAPIKey(apiKey);
        
        if (!validation.valid) {
          logger.warn('Invalid API key attempt', {
            error: validation.error,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          res.status(401).json({
            error: 'Unauthorized',
            message: validation.message,
            code: validation.error
          });
          return;
        }

        const quotaCheck = await this.quotaService.checkQuota(validation.apiKey!);
        
        if (!quotaCheck.has_quota) {
          logger.warn('Quota exceeded', {
            keyId: validation.apiKey!.id,
            dailyRemaining: quotaCheck.daily_remaining,
            monthlyRemaining: quotaCheck.monthly_remaining
          });

          res.status(429).json({
            error: 'Quota Exceeded',
            message: 'API quota exceeded',
            quota_info: {
              daily_remaining: quotaCheck.daily_remaining,
              monthly_remaining: quotaCheck.monthly_remaining,
              reset_daily: quotaCheck.reset_daily,
              reset_monthly: quotaCheck.reset_monthly
            }
          });
          return;
        }

        if (validation.apiKey) {
          req.apiKey = validation.apiKey;
        }
        req.quotaInfo = quotaCheck;

        res.on('finish', async () => {
          if (validation.apiKey) {
            await this.recordUsage(validation.apiKey, req, res, startTime);
          }
        });

        next();

      } catch (error) {
        logger.error('API key middleware error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authentication failed'
        });
      }
    };
  }

  private extractAPIKey(req: Request): string | null {
    const headerKey = req.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const queryKey = req.query['api_key'] as string;
    if (queryKey) {
      return queryKey;
    }

    return null;
  }

  private async recordUsage(apiKey: APIKey, req: Request, res: Response, startTime: number): Promise<void> {
    try {
      const responseTime = Date.now() - startTime;
      const tokensUsed = this.estimateTokens(req, res);
      
      await this.quotaService.recordUsage(apiKey, tokensUsed);
      
      logger.info('API key usage recorded', {
        key_id: apiKey.id,
        key_name: apiKey.name,
        tier: apiKey.tier,
        endpoint: req.path,
        method: req.method,
        status_code: res.statusCode,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      });
      
    } catch (error) {
      logger.error('Failed to record API key usage:', error);
    }
  }

  private estimateTokens(req: Request, res: Response): number {
    try {
      const requestSize = JSON.stringify(req.body || {}).length;
      const contentLength = res.get('content-length');
      const responseSize = contentLength ? parseInt(contentLength) : 0;
      
      return Math.ceil((requestSize + responseSize) / 4);
    } catch (error) {
      return 0;
    }
  }
}

export function createAPIKeyTrackingMiddleware(
  apiKeyService: APIKeyService,
  quotaService: QuotaService
) {
  const middleware = new APIKeyTrackingMiddleware(apiKeyService, quotaService);
  return middleware.middleware();
}
