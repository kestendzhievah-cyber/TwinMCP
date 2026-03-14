/**
 * API Key Service — Single source of truth for all API key operations.
 * Startup-grade: creation, validation, revocation, listing, rename, expiration,
 * usage tracking, analytics, daily counter reset.
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

// ─── Expiration presets ───────────────────────────────────────────
export const EXPIRATION_PRESETS = {
  '30d': { label: '30 jours', days: 30 },
  '90d': { label: '90 jours', days: 90 },
  '180d': { label: '6 mois', days: 180 },
  '365d': { label: '1 an', days: 365 },
  never: { label: 'Jamais', days: 0 },
} as const;

export type ExpirationPreset = keyof typeof EXPIRATION_PRESETS;

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
    expiresAt: string | null;
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
  tier: PlanId,
  expiresIn?: ExpirationPreset
): Promise<CreateKeyResult | CreateKeyError> {
  const limits = getApiKeyLimits(tier);

  // Compute expiration date
  let expiresAt: Date | null = null;
  if (expiresIn && expiresIn !== 'never') {
    const preset = EXPIRATION_PRESETS[expiresIn];
    if (preset && preset.days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + preset.days);
    }
  }

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
          expiresAt,
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
          expiresAt: apiKey.expiresAt?.toISOString() || null,
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
      expiresAt: expiresAt?.toISOString() || 'never',
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
    select: { id: true, keyPrefix: true, name: true, tier: true, expiresAt: true, createdAt: true, lastUsedAt: true },
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
    expiresAt: key.expiresAt?.toISOString() || null,
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

// ─── Rename API key ──────────────────────────────────────────────
export async function renameApiKey(
  keyId: string,
  userId: string,
  newName: string
): Promise<{ success: boolean; error?: string; status?: number }> {
  const nameResult = sanitizeKeyName(newName);
  if (!nameResult.valid) {
    return { success: false, error: nameResult.error, status: 400 };
  }

  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId, isActive: true, revokedAt: null },
    select: { id: true },
  });

  if (!key) {
    return { success: false, error: 'API key not found', status: 404 };
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { name: nameResult.name },
  });

  logger.info('[api-key] Key renamed', { userId, keyId, newName: nameResult.name, action: 'RENAME' });
  return { success: true };
}

// ─── Get single API key detail ───────────────────────────────────
export async function getApiKeyDetail(keyId: string, userId: string) {
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      tier: true,
      quotaDaily: true,
      quotaMonthly: true,
      usedDaily: true,
      usedMonthly: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      permissions: true,
    },
  });

  if (!key) return null;

  const limits = getApiKeyLimits(key.tier);
  return {
    ...key,
    quotaRequestsPerDay: limits.dailyLimit,
    quotaRequestsPerMinute: limits.rateLimit,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() || null,
    expiresAt: key.expiresAt?.toISOString() || null,
    revokedAt: key.revokedAt?.toISOString() || null,
  };
}

// ─── Log API key usage (called by middleware/routes on each API call) ─
export async function logKeyUsage(opts: {
  apiKeyId: string;
  userId: string;
  toolName: string;
  query?: string;
  responseTimeMs?: number;
  tokensReturned?: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    // Fire-and-forget: create log + increment counters in parallel
    await Promise.all([
      prisma.usageLog.create({
        data: {
          apiKeyId: opts.apiKeyId,
          userId: opts.userId,
          toolName: opts.toolName,
          query: opts.query?.substring(0, 500) || null,
          responseTimeMs: opts.responseTimeMs || null,
          tokensReturned: opts.tokensReturned || null,
          success: opts.success,
          errorMessage: opts.errorMessage?.substring(0, 500) || null,
        },
      }),
      prisma.apiKey.update({
        where: { id: opts.apiKeyId },
        data: {
          usedDaily: { increment: 1 },
          usedMonthly: { increment: 1 },
          lastUsedAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    logger.error('[api-key] logKeyUsage failed:', { error, apiKeyId: opts.apiKeyId });
  }
}

// ─── Get per-key usage history (last N days) ─────────────────────
export async function getKeyUsageHistory(
  keyId: string,
  userId: string,
  days: number = 30
): Promise<{ date: string; requests: number; successes: number; errors: number; avgResponseTime: number }[]> {
  // Verify ownership
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
    select: { id: true },
  });
  if (!key) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Raw SQL for date-grouped aggregation (much faster than groupBy on large tables)
  const rows = await prisma.$queryRaw<
    { day: Date; total: bigint; successes: bigint; errors: bigint; avg_rt: number | null }[]
  >`
    SELECT
      DATE("created_at") as day,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE success = true) as successes,
      COUNT(*) FILTER (WHERE success = false) as errors,
      AVG("response_time_ms") FILTER (WHERE "response_time_ms" IS NOT NULL) as avg_rt
    FROM usage_logs
    WHERE api_key_id = ${keyId}
      AND created_at >= ${since}
    GROUP BY DATE("created_at")
    ORDER BY day ASC
  `;

  return rows.map((r) => ({
    date: r.day.toISOString().split('T')[0],
    requests: Number(r.total),
    successes: Number(r.successes),
    errors: Number(r.errors),
    avgResponseTime: Math.round(r.avg_rt || 0),
  }));
}

// ─── Get per-key usage analytics (top tools, error breakdown) ────
export async function getKeyUsageAnalytics(
  keyId: string,
  userId: string
): Promise<{
  topTools: { tool: string; count: number; successRate: number }[];
  recentErrors: { tool: string; error: string; at: string }[];
  totals: { today: number; thisWeek: number; thisMonth: number; allTime: number };
  avgResponseTime: number;
} | null> {
  // Verify ownership
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
    select: { id: true },
  });
  if (!key) return null;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [topToolsRaw, recentErrors, todayCount, weekCount, monthCount, allTimeCount, avgRt] =
    await Promise.all([
      // Top tools
      prisma.usageLog.groupBy({
        by: ['toolName', 'success'],
        where: { apiKeyId: keyId },
        _count: true,
        orderBy: { _count: { toolName: 'desc' } },
      }),
      // Recent errors
      prisma.usageLog.findMany({
        where: { apiKeyId: keyId, success: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { toolName: true, errorMessage: true, createdAt: true },
      }),
      // Counts
      prisma.usageLog.count({ where: { apiKeyId: keyId, createdAt: { gte: todayStart } } }),
      prisma.usageLog.count({ where: { apiKeyId: keyId, createdAt: { gte: weekStart } } }),
      prisma.usageLog.count({ where: { apiKeyId: keyId, createdAt: { gte: monthStart } } }),
      prisma.usageLog.count({ where: { apiKeyId: keyId } }),
      // Avg response time
      prisma.usageLog.aggregate({
        where: { apiKeyId: keyId, responseTimeMs: { not: null } },
        _avg: { responseTimeMs: true },
      }),
    ]);

  // Merge tool stats
  const toolMap = new Map<string, { total: number; success: number }>();
  for (const row of topToolsRaw) {
    const entry = toolMap.get(row.toolName) || { total: 0, success: 0 };
    entry.total += row._count;
    if (row.success) entry.success += row._count;
    toolMap.set(row.toolName, entry);
  }
  const topTools = Array.from(toolMap.entries())
    .map(([tool, s]) => ({
      tool,
      count: s.total,
      successRate: s.total > 0 ? Math.round((s.success / s.total) * 1000) / 10 : 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    topTools,
    recentErrors: recentErrors.map((e) => ({
      tool: e.toolName,
      error: e.errorMessage || 'Unknown error',
      at: e.createdAt.toISOString(),
    })),
    totals: {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      allTime: allTimeCount,
    },
    avgResponseTime: Math.round(avgRt._avg.responseTimeMs || 0),
  };
}

// ─── Reset daily counters (called by cron or on first request of the day) ─
export async function resetDailyCounters(): Promise<number> {
  const result = await prisma.apiKey.updateMany({
    where: { isActive: true, usedDaily: { gt: 0 } },
    data: { usedDaily: 0 },
  });
  logger.info('[api-key] Daily counters reset', { count: result.count });
  return result.count;
}

// ─── Reset monthly counters ──────────────────────────────────────
export async function resetMonthlyCounters(): Promise<number> {
  const result = await prisma.apiKey.updateMany({
    where: { isActive: true, usedMonthly: { gt: 0 } },
    data: { usedMonthly: 0 },
  });
  logger.info('[api-key] Monthly counters reset', { count: result.count });
  return result.count;
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
