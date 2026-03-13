import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

export interface ApiKeyData {
  id: string;
  userId: string;
  keyPrefix: string;
  tier: string;
  quotaDaily: number;
  quotaMonthly: number;
  permissions: unknown;
  quotaRequestsPerMinute: number;
  quotaRequestsPerDay: number;
}

export interface AuthResult {
  success: boolean;
  apiKeyData?: ApiKeyData;
  error?: string;
  errorCode?: 'INVALID_API_KEY' | 'RATE_LIMITED' | 'EXPIRED_API_KEY' | 'INACTIVE_API_KEY';
  statusCode?: number;
}

export class AuthService {
  private db: PrismaClient;
  private redis: Redis;

  constructor(db: PrismaClient, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async validateApiKey(apiKey: string): Promise<AuthResult> {
    try {
      if (!apiKey?.startsWith('twinmcp_')) {
        return {
          success: false,
          error: 'Invalid API key format',
          errorCode: 'INVALID_API_KEY',
          statusCode: 401,
        };
      }

      // Lookup by SHA-256 hash (primary method — used by new key generation)
      const { createHash } = await import('crypto');
      const keyHash = createHash('sha256').update(apiKey).digest('hex');

      let apiKeyRecord = await this.db.apiKey.findUnique({
        where: { keyHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              clientId: true,
            },
          },
        },
      });

      // Fallback: lookup by prefix + bcrypt compare (legacy keys)
      if (!apiKeyRecord) {
        const keyPrefix = apiKey.substring(0, 20);
        const candidates = await this.db.apiKey.findMany({
          where: {
            keyPrefix,
            revokedAt: null,
            isActive: true,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                clientId: true,
              },
            },
          },
        });

        for (const candidate of candidates) {
          try {
            const isValid = await bcrypt.compare(apiKey, candidate.keyHash);
            if (isValid) {
              apiKeyRecord = candidate;
              break;
            }
          } catch {
            // Not a bcrypt hash, skip
          }
        }
      }

      if (!apiKeyRecord || !apiKeyRecord.isActive || apiKeyRecord.revokedAt) {
        return {
          success: false,
          error: 'API key not found or revoked',
          errorCode: 'INVALID_API_KEY',
          statusCode: 401,
        };
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        return {
          success: false,
          error: 'API key has expired',
          errorCode: 'EXPIRED_API_KEY',
          statusCode: 401,
        };
      }

      // Vérifier les quotas
      const quotaCheck = await this.checkQuotas(
        apiKeyRecord.id,
        apiKeyRecord.quotaDaily,
        apiKeyRecord.quotaMonthly
      );
      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: quotaCheck.reason,
          errorCode: 'RATE_LIMITED',
          statusCode: 429,
        };
      }

      // Fire-and-forget — don't block response on lastUsedAt write
      this.db.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      const quotaRequestsPerMinute = Math.max(1, Math.floor(apiKeyRecord.quotaDaily / (24 * 60)));

      return {
        success: true,
        apiKeyData: {
          id: apiKeyRecord.id,
          userId: apiKeyRecord.userId,
          keyPrefix: apiKeyRecord.keyPrefix,
          tier: apiKeyRecord.tier,
          quotaDaily: apiKeyRecord.quotaDaily,
          quotaMonthly: apiKeyRecord.quotaMonthly,
          permissions: apiKeyRecord.permissions,
          quotaRequestsPerMinute,
          quotaRequestsPerDay: apiKeyRecord.quotaDaily,
        },
      };
    } catch (error) {
      logger.error('Error validating API key:', error);
      return {
        success: false,
        error: 'Authentication failed',
        errorCode: 'INVALID_API_KEY',
        statusCode: 401,
      };
    }
  }

  private async checkQuotas(
    apiKeyId: string,
    dailyLimit: number,
    monthlyLimit: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const dayKey = `quota:daily:${apiKeyId}:${now.toISOString().slice(0, 10)}`;
    const monthKey = `quota:monthly:${apiKeyId}:${now.toISOString().slice(0, 7)}`;

    if (dailyLimit !== -1) {
      const dayCount = await this.redis.incr(dayKey);
      if (dayCount === 1) {
        await this.redis.expire(dayKey, this.getSecondsUntilEndOfDay(now));
      }

      if (dayCount > dailyLimit) {
        return {
          allowed: false,
          reason: 'Daily quota exceeded',
        };
      }
    }

    if (monthlyLimit !== -1) {
      const monthCount = await this.redis.incr(monthKey);
      if (monthCount === 1) {
        await this.redis.expire(monthKey, this.getSecondsUntilEndOfMonth(now));
      }

      if (monthCount > monthlyLimit) {
        return {
          allowed: false,
          reason: 'Monthly quota exceeded',
        };
      }
    }

    return { allowed: true };
  }

  async generateApiKey(
    userId: string,
    name?: string,
    tier: string = 'free',
    quotaDaily: number = 200,
    quotaMonthly: number = 6000
  ): Promise<{ apiKey: string; prefix: string; id: string }> {
    const keyPrefix_str = tier === 'free' ? 'twinmcp_free_' : 'twinmcp_live_';
    const randomPart = randomBytes(24).toString('hex');
    const apiKey = keyPrefix_str + randomPart;

    // Hash with SHA-256 (consistent with route-level key generation)
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 20);

    // Atomic transaction to prevent race condition on concurrent creates
    const maxKeys = tier === 'enterprise' ? 100 : tier === 'pro' ? 10 : 3;

    const record = await this.db.$transaction(async (tx) => {
      const existingCount = await tx.apiKey.count({
        where: { userId, isActive: true, revokedAt: null },
      });
      if (existingCount >= maxKeys) {
        throw new Error(`Key limit reached (${maxKeys}) for plan ${tier}`);
      }

      return tx.apiKey.create({
        data: {
          userId,
          keyHash,
          keyPrefix,
          name: name || `API Key ${new Date().toISOString()}`,
          tier,
          quotaDaily,
          quotaMonthly,
          permissions: ['read', 'write'],
        },
      });
    });

    return {
      apiKey,
      prefix: keyPrefix,
      id: record.id,
    };
  }

  async revokeApiKey(apiKeyId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.apiKey.updateMany({
        where: {
          id: apiKeyId,
          userId,
          revokedAt: null,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error('Error revoking API key:', error);
      return false;
    }
  }

  async listUserApiKeys(userId: string) {
    const keys = await this.db.apiKey.findMany({
      where: {
        userId,
        isActive: true,
        revokedAt: null,
      },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        tier: true,
        quotaDaily: true,
        quotaMonthly: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return keys.map((key: (typeof keys)[number]) => ({
      ...key,
      quotaRequestsPerMinute: Math.max(1, Math.floor(key.quotaDaily / (24 * 60))),
      quotaRequestsPerDay: key.quotaDaily,
    }));
  }

  async logUsage(
    apiKeyId: string,
    toolName: string,
    libraryId?: string,
    query?: string,
    tokensReturned?: number,
    responseTimeMs?: number
  ) {
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Atomic transaction: create log + update counters in one shot
      await this.db.$transaction(async (tx) => {
        const apiKeyRecord = await tx.apiKey.findUnique({
          where: { id: apiKeyId },
          select: { usedDaily: true, usedMonthly: true, lastUsedAt: true, userId: true },
        });

        // Reset counters on day/month boundary using actual date comparison
        const sameDay = apiKeyRecord?.lastUsedAt
          ? apiKeyRecord.lastUsedAt >= todayStart
          : false;
        const sameMonth = apiKeyRecord?.lastUsedAt
          ? apiKeyRecord.lastUsedAt >= monthStart
          : false;

        const usedDaily = sameDay ? (apiKeyRecord?.usedDaily || 0) + 1 : 1;
        const usedMonthly = sameMonth ? (apiKeyRecord?.usedMonthly || 0) + 1 : 1;

        await tx.usageLog.create({
          data: {
            apiKeyId,
            userId: apiKeyRecord?.userId,
            toolName,
            libraryId,
            query,
            tokensReturned,
            responseTimeMs,
          },
        });

        await tx.apiKey.update({
          where: { id: apiKeyId },
          data: {
            usedDaily,
            usedMonthly,
            lastUsedAt: now,
          },
        });
      });
    } catch (error) {
      logger.error('Error logging usage:', error);
    }
  }

  private isSameDay(date: Date | null | undefined, now: Date): boolean {
    if (!date) return false;
    return date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  }

  private isSameMonth(date: Date | null | undefined, now: Date): boolean {
    if (!date) return false;
    return date.toISOString().slice(0, 7) === now.toISOString().slice(0, 7);
  }

  private getSecondsUntilEndOfDay(now: Date): number {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
  }

  private getSecondsUntilEndOfMonth(now: Date): number {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return Math.max(1, Math.floor((endOfMonth.getTime() - now.getTime()) / 1000));
  }
}
