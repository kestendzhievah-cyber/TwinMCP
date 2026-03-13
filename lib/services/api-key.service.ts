/**
 * API Key Service — Single source of truth for all API key operations.
 * Centralizes: creation, validation, revocation, listing, plan limits.
 * Eliminates duplication across api-keys/route.ts, v1/api-keys/route.ts, auth.service.ts.
 */

import { prisma } from '@/lib/prisma';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { getPlanLimits, resolvePlanId, type PlanId } from '@/lib/services/stripe-billing.service';

// ─── Plan-derived limits for API keys ─────────────────────────────
export function getApiKeyLimits(plan: string) {
  const resolved = resolvePlanId(plan);
  const limits = getPlanLimits(resolved);
  const rateLimit = resolved === 'enterprise' ? 2000 : resolved === 'pro' ? 200 : 20;
  const maxKeys = resolved === 'enterprise' ? 100 : resolved === 'pro' ? 10 : 3;
  const monthlyLimit = limits.requestsPerDay === -1 ? 3000000 : limits.requestsPerDay * 30;
  return {
    dailyLimit: limits.requestsPerDay === -1 ? 100000 : limits.requestsPerDay,
    monthlyLimit,
    maxKeys,
    rateLimit,
  };
}

export type ApiKeyLimits = ReturnType<typeof getApiKeyLimits>;

// ─── Ensure user exists in DB (idempotent) ────────────────────────
export async function ensureUser(userId: string, email?: string) {
  let user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { oauthId: userId }] },
    select: { id: true, email: true, name: true, oauthId: true, clientId: true },
  });

  if (!user) {
    let defaultClient = await prisma.client.findFirst({ where: { name: 'default' } });
    if (!defaultClient) {
      defaultClient = await prisma.client.create({ data: { name: 'default', apiKeys: {} } });
    }
    user = await prisma.user.create({
      data: {
        id: userId,
        email: email || `user-${userId}@twinmcp.local`,
        oauthId: userId,
        oauthProvider: 'firebase',
        clientId: defaultClient.id,
      },
    });
  }

  return user;
}

// ─── Get user plan tier ───────────────────────────────────────────
export async function getUserTier(userId: string): Promise<PlanId> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { plan: true, subscriptions: { where: { status: 'ACTIVE' }, select: { plan: true }, take: 1 } },
    });
    const plan = profile?.plan || profile?.subscriptions?.[0]?.plan || 'free';
    return resolvePlanId(plan);
  } catch {
    return 'free';
  }
}

// ─── Sanitize key name (strip HTML/script, trim, enforce length) ──
const NAME_MIN = 1;
const NAME_MAX = 100;
const HTML_TAG_RE = /<[^>]*>/g;

export function sanitizeKeyName(
  raw: unknown
): { valid: true; name: string } | { valid: false; error: string } {
  if (typeof raw !== 'string') {
    return { valid: false, error: 'Name must be a string' };
  }
  // Strip HTML tags to prevent stored XSS
  const stripped = raw.replace(HTML_TAG_RE, '').trim();
  if (stripped.length < NAME_MIN) {
    return { valid: false, error: 'Name is required' };
  }
  if (stripped.length > NAME_MAX) {
    return { valid: false, error: `Name must be at most ${NAME_MAX} characters` };
  }
  return { valid: true, name: stripped };
}

// ─── Create API key ───────────────────────────────────────────────
export interface CreateKeyResult {
  success: true;
  apiKey: {
    id: string;
    rawKey: string;
    keyPrefix: string;
    name: string;
    tier: string;
    quotaRequestsPerDay: number;
    quotaRequestsPerMinute: number;
    createdAt: string;
    usage: { requestsToday: number; requestsThisHour: number; successRate: number };
  };
}

export interface CreateKeyError {
  success: false;
  error: string;
  code?: string;
  status: number;
}

export async function createApiKey(
  userId: string,
  name: string,
  tier: PlanId
): Promise<CreateKeyResult | CreateKeyError> {
  const limits = getApiKeyLimits(tier);

  // Atomic check: use a transaction to prevent race condition on key count
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.apiKey.count({
        where: { userId, isActive: true, revokedAt: null },
      });

      if (existingCount >= limits.maxKeys) {
        return {
          success: false as const,
          error: `Limite de ${limits.maxKeys} clés atteinte pour le plan ${tier}. Passez au plan supérieur pour plus de clés.`,
          code: 'KEY_LIMIT_EXCEEDED',
          status: 400,
        };
      }

      // Generate key
      const prefix = tier === 'free' ? 'twinmcp_free_' : 'twinmcp_live_';
      const randomPart = randomBytes(24).toString('hex');
      const rawKey = `${prefix}${randomPart}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 20);

      const apiKey = await tx.apiKey.create({
        data: {
          userId,
          keyHash,
          keyPrefix,
          name,
          tier,
          quotaDaily: limits.dailyLimit,
          quotaMonthly: limits.monthlyLimit,
          permissions: ['read', 'write'],
        },
      });

      return {
        success: true as const,
        apiKey: {
          id: apiKey.id,
          rawKey,
          keyPrefix: apiKey.keyPrefix,
          name: apiKey.name || name,
          tier: apiKey.tier,
          quotaRequestsPerDay: limits.dailyLimit,
          quotaRequestsPerMinute: limits.rateLimit,
          createdAt: apiKey.createdAt.toISOString(),
          usage: { requestsToday: 0, requestsThisHour: 0, successRate: 100 },
        },
      };
    });

    // Log audit event
    logger.info('[api-key] Key created', {
      userId,
      keyId: result.success ? result.apiKey.id : undefined,
      tier,
      action: 'CREATE',
    });

    return result;
  } catch (error) {
    logger.error('[api-key] Create failed:', error);
    return {
      success: false,
      error: 'Internal server error',
      status: 500,
    };
  }
}

// ─── Revoke API key ───────────────────────────────────────────────
export async function revokeApiKey(
  keyId: string,
  userId: string
): Promise<{ success: boolean; error?: string; status?: number }> {
  // Verify ownership
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
    select: { id: true, keyPrefix: true, isActive: true, revokedAt: true },
  });

  if (!key) {
    return { success: false, error: 'API key not found', status: 404 };
  }

  if (!key.isActive || key.revokedAt) {
    return { success: false, error: 'API key already revoked', status: 400 };
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false, revokedAt: new Date() },
  });

  // Log audit event
  logger.info('[api-key] Key revoked', {
    userId,
    keyId,
    keyPrefix: key.keyPrefix,
    action: 'REVOKE',
  });

  return { success: true };
}

// ─── List user API keys with batch stats ──────────────────────────
export async function listApiKeys(userId: string, tier: PlanId) {
  const limits = getApiKeyLimits(tier);

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId, isActive: true, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, keyPrefix: true, name: true, tier: true, createdAt: true, lastUsedAt: true },
  });

  // Batch stats: groupBy instead of N+1 queries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hourAgo = new Date(Date.now() - 3600000);
  const keyIds = apiKeys.map((k) => k.id);

  const dailyByKey = new Map<string, number>();
  const hourlyByKey = new Map<string, number>();
  const successByKey = new Map<string, number>();

  if (keyIds.length > 0) {
    try {
      // 3 lightweight groupBy queries instead of fetching N*50 rows
      const [dailyAgg, hourlyAgg, successAgg] = await Promise.all([
        prisma.usageLog.groupBy({
          by: ['apiKeyId'],
          where: { apiKeyId: { in: keyIds }, createdAt: { gte: today } },
          _count: true,
        }),
        prisma.usageLog.groupBy({
          by: ['apiKeyId'],
          where: { apiKeyId: { in: keyIds }, createdAt: { gte: hourAgo } },
          _count: true,
        }),
        prisma.usageLog.groupBy({
          by: ['apiKeyId', 'success'],
          where: { apiKeyId: { in: keyIds } },
          _count: true,
        }),
      ]);

      for (const row of dailyAgg) {
        if (row.apiKeyId) dailyByKey.set(row.apiKeyId, row._count);
      }
      for (const row of hourlyAgg) {
        if (row.apiKeyId) hourlyByKey.set(row.apiKeyId, row._count);
      }

      // Build success rate from groupBy(apiKeyId, success) — no row fetching needed
      const logsByKey = new Map<string, { total: number; success: number }>();
      for (const row of successAgg) {
        if (!row.apiKeyId) continue;
        const entry = logsByKey.get(row.apiKeyId) || { total: 0, success: 0 };
        entry.total += row._count;
        if (row.success) entry.success += row._count;
        logsByKey.set(row.apiKeyId, entry);
      }
      for (const [kid, stats] of logsByKey) {
        successByKey.set(
          kid,
          stats.total > 0 ? Math.round((stats.success / stats.total) * 1000) / 10 : 100
        );
      }
    } catch {
      // Keep empty maps — degrade gracefully
    }
  }

  const keysWithStats = apiKeys.map((key) => ({
    id: key.id,
    keyPrefix: key.keyPrefix,
    name: key.name || 'Sans nom',
    tier: key.tier,
    quotaRequestsPerDay: limits.dailyLimit,
    quotaRequestsPerMinute: limits.rateLimit,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() || null,
    usage: {
      requestsToday: dailyByKey.get(key.id) || 0,
      requestsThisHour: hourlyByKey.get(key.id) || 0,
      successRate: successByKey.get(key.id) ?? 100,
    },
  }));

  return { keys: keysWithStats, limits };
}

// ─── Timing-safe API key hash comparison ──────────────────────────
export function safeCompareHash(inputHash: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(inputHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
