/**
 * Plan configuration — single source of truth.
 * Re-exports from the centralized stripe-billing service and adds
 * backward-compatible helpers used by user-limits and other modules.
 */
import {
  PLAN_CONFIG as _PLAN_CONFIG,
  resolvePlanId,
  getPlanLimits,
  type PlanId,
} from '@/lib/services/stripe-billing.service';

interface LegacyPlanConfig {
  mcpServers: number;
  requestsPerDay: number;
  privateServers: boolean;
  features: string[];
  support: string;
  price: number;
  priceAnnual: number;
}

const SUPPORT_MAP: Record<PlanId, string> = {
  free: 'Communauté',
  pro: 'Prioritaire 24/7',
  enterprise: 'Account manager dédié',
};

// Build legacy-compatible PLAN_CONFIG from the centralized source
function buildLegacy(id: PlanId): LegacyPlanConfig {
  const plan = _PLAN_CONFIG[id];
  return {
    mcpServers: plan.limits.mcpServers,
    requestsPerDay: plan.limits.requestsPerDay,
    privateServers: plan.limits.privateServers,
    features: [...plan.features],
    support: SUPPORT_MAP[id],
    price: plan.priceMonthly,
    priceAnnual: plan.priceAnnual,
  };
}

export const PLAN_CONFIG: Record<string, LegacyPlanConfig> = {
  free: buildLegacy('free'),
  pro: buildLegacy('pro'),
  professional: buildLegacy('pro'), // backward compat alias
  enterprise: buildLegacy('enterprise'),
};

export function getPlanConfig(plan: string): LegacyPlanConfig {
  const resolved = resolvePlanId(plan);
  return PLAN_CONFIG[resolved] ?? PLAN_CONFIG.free;
}

export function getSuggestedUpgrade(currentPlan: string): string | null {
  switch (resolvePlanId(currentPlan)) {
    case 'free':
      return 'pro';
    case 'pro':
      return 'enterprise';
    case 'enterprise':
      return null;
    default:
      return 'pro';
  }
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function formatLimit(value: number, unit: string = ''): string {
  if (isUnlimited(value)) {
    return '∞';
  }
  return `${value.toLocaleString()}${unit}`;
}

// Re-export for convenience
export { resolvePlanId, getPlanLimits, type PlanId };
