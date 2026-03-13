/**
 * Pro plan gate — reusable helper to enforce Pro plan access for MCP Tools.
 */
import { prisma } from '@/lib/prisma';
import { resolvePlanId } from '@/lib/plan-config';
import { TwinMCPError } from '@/lib/errors';

export class ProPlanRequiredError extends TwinMCPError {
  public readonly currentPlan: string;

  constructor(currentPlan: string) {
    super('PRO_PLAN_REQUIRED', 'Les Outils MCP sont réservés aux utilisateurs du plan Pro.', 403);
    this.name = 'ProPlanRequiredError';
    this.currentPlan = currentPlan;
  }
}

/**
 * Returns the user's resolved plan ID.
 * Throws ProPlanRequiredError if the user is on the free plan.
 */
export async function requireProPlan(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { plan: true },
  });

  const plan = resolvePlanId(profile?.plan || 'free');

  if (plan === 'free') {
    throw new ProPlanRequiredError(plan);
  }

  return plan;
}

/**
 * Returns the user's plan without throwing — useful for read-only checks.
 */
export async function getUserPlanSafe(userId: string): Promise<string> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { plan: true },
    });
    return resolvePlanId(profile?.plan || 'free');
  } catch {
    return 'free';
  }
}

export function isProOrAbove(plan: string): boolean {
  const resolved = resolvePlanId(plan);
  return resolved === 'pro' || resolved === 'enterprise';
}
