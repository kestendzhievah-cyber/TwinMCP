/**
 * User limits — Prisma-based (replaces old Firebase Firestore version).
 * All queries hit PostgreSQL via Prisma.
 */
import { prisma } from '@/lib/prisma';
import { getPlanConfig, getSuggestedUpgrade, isUnlimited } from './plan-config';
import { logger } from '@/lib/logger';

interface LimitInfo {
  current: number;
  max: number;
  remaining: number;
}

export interface UserLimitsResponse {
  plan: string;
  limits: {
    mcpServers: LimitInfo;
    requestsPerDay: LimitInfo;
  };
  canCreateMcpServer: boolean;
  canMakeRequest: boolean;
  hasPrivateServers: boolean;
  suggestedUpgrade: string | null;
  subscriptionStatus?: string;
}

/**
 * Get user plan from UserProfile (source of truth, updated by Stripe webhooks).
 */
async function getUserPlan(userId: string): Promise<string> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { plan: true },
    });
    return profile?.plan || 'free';
  } catch {
    return 'free';
  }
}

export async function canCreateMcpServer(userId: string): Promise<{
  allowed: boolean;
  currentCount?: number;
  limit?: number;
  message?: string;
  plan?: string;
  suggestedUpgrade?: string | null;
}> {
  try {
    const plan = await getUserPlan(userId);
    const planConfig = getPlanConfig(plan);

    const currentCount = await countActiveMcpServers(userId);
    const limit = planConfig.mcpServers;
    const allowed = isUnlimited(limit) || currentCount < limit;

    return {
      allowed,
      currentCount,
      limit,
      plan,
      suggestedUpgrade: !allowed ? 'pro' : null,
    };
  } catch (error) {
    logger.error('Error checking MCP server creation limits:', error);
    return { allowed: false, message: 'Erreur lors de la vérification des limites' };
  }
}

export async function countActiveMcpServers(userId: string): Promise<number> {
  try {
    // Count MCP configurations owned by the user that are enabled
    return await prisma.mCPConfiguration.count({
      where: { userId, status: 'ACTIVE' },
    });
  } catch (error) {
    logger.error('Error counting active MCP servers:', error);
    return 0;
  }
}

export async function countDailyRequests(userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.usageLog.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });
  } catch (error) {
    logger.error('Error counting daily requests:', error);
    return 0;
  }
}

export async function canMakeRequest(userId: string): Promise<{
  allowed: boolean;
  currentCount?: number;
  limit?: number;
  message?: string;
  plan?: string;
  suggestedUpgrade?: string | null;
}> {
  try {
    const plan = await getUserPlan(userId);
    const planConfig = getPlanConfig(plan);

    const currentCount = await countDailyRequests(userId);
    const limit = planConfig.requestsPerDay;
    const allowed = isUnlimited(limit) || currentCount < limit;

    return {
      allowed,
      currentCount,
      limit,
      plan,
      suggestedUpgrade: !allowed ? 'pro' : null,
    };
  } catch (error) {
    logger.error('Error checking request limits:', error);
    return { allowed: false, message: 'Erreur lors de la vérification des limites' };
  }
}

export async function getUserLimits(userId: string): Promise<UserLimitsResponse> {
  try {
    const plan = await getUserPlan(userId);
    const planConfig = getPlanConfig(plan);
    const suggestedUpgrade = getSuggestedUpgrade(plan);

    // Run both counts in parallel
    const [mcpServersCount, dailyRequestsCount] = await Promise.all([
      countActiveMcpServers(userId),
      countDailyRequests(userId),
    ]);

    const mcpServersRemaining = isUnlimited(planConfig.mcpServers)
      ? Infinity
      : Math.max(0, planConfig.mcpServers - mcpServersCount);
    const requestsRemaining = isUnlimited(planConfig.requestsPerDay)
      ? Infinity
      : Math.max(0, planConfig.requestsPerDay - dailyRequestsCount);

    const limits = {
      mcpServers: {
        current: mcpServersCount,
        max: planConfig.mcpServers,
        remaining: mcpServersRemaining,
      },
      requestsPerDay: {
        current: dailyRequestsCount,
        max: planConfig.requestsPerDay,
        remaining: requestsRemaining,
      },
    };

    const canCreateServer =
      isUnlimited(planConfig.mcpServers) || mcpServersCount < planConfig.mcpServers;
    const canRequest =
      isUnlimited(planConfig.requestsPerDay) || dailyRequestsCount < planConfig.requestsPerDay;

    // Get subscription status
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const subStatus = profile?.subscriptions?.[0]?.status || 'ACTIVE';

    return {
      plan,
      limits,
      canCreateMcpServer: canCreateServer,
      canMakeRequest: canRequest,
      hasPrivateServers: planConfig.privateServers,
      suggestedUpgrade: suggestedUpgrade ? String(suggestedUpgrade) : null,
      subscriptionStatus: subStatus.toLowerCase(),
    };
  } catch (error) {
    logger.error('Error getting user limits:', error);
    throw error;
  }
}

export async function recordApiRequest(userId: string, endpoint: string): Promise<void> {
  try {
    await prisma.usageLog.create({
      data: {
        userId,
        toolName: endpoint,
        success: true,
      },
    });
  } catch (error) {
    logger.error('Error recording API request:', error);
  }
}

export async function updateUserMcpServersCount(
  _userId: string,
  _newCount: number
): Promise<void> {
  // No-op: MCP server count is now derived from the MCPConfiguration table.
  // Kept for backward compatibility with callers.
}

// ============================================
// LEGACY COMPATIBILITY ALIASES
// ============================================

export const canCreateAgent = canCreateMcpServer;
export const countActiveAgents = countActiveMcpServers;
export const updateUserAgentsCount = updateUserMcpServersCount;
