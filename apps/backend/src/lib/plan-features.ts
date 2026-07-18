import type { Plan } from "@/db/schema/core";
import type { BoxSize } from "@/db/schema/platform";

/**
 * Single source of truth for what each subscription plan is allowed to do.
 *
 * Both the server-side enforcement (API routes) and the client-side upsell UI
 * (dashboard) read from this table, so limits never drift between the API, the
 * marketing pricing page, and the gating UI. Keep the numbers in sync with
 * `components/pricing/pricing-data.ts` (the marketing-facing copy).
 *
 * ENFORCEMENT IS NOT AUTOMATIC. The helpers below are pure predicates. Defining
 * a capability here gates nothing on its own — each one must be enforced where
 * it is used by calling the matching assertion in the relevant API route. As of
 * writing, `servers` is enforced (lib/quota.ts → api/v2/servers), and box size,
 * api keys, and members are enforced in their respective v2 routes.
 *
 * This module imports types only — it is safe to import from both Server and
 * Client Components.
 */

const UNLIMITED = Number.POSITIVE_INFINITY;

export interface PlanCapabilities {
  /** Max non-destroyed servers a user may own. */
  servers: number;
  /** Box sizes the user may provision. */
  boxSizes: readonly BoxSize[];
  /** Max active API keys on the account (api_keys are account-level, not per-server). */
  apiKeys: number;
  /** Max members in the user's teamspace (owner included). */
  members: number;
  /** May publish MCPs to the catalog. */
  publishMcp: boolean;
  /** May choose the deployment region. */
  regionSelection: boolean;
  /** Audit-log retention in days (0 = not retained / not surfaced). */
  auditRetentionDays: number;
  /** May export usage metrics. */
  usageExport: boolean;
}

export const PLAN_CAPABILITIES: Record<Plan, PlanCapabilities> = {
  free: {
    servers: 1,
    boxSizes: ["small"],
    apiKeys: 1,
    members: 1,
    publishMcp: false,
    regionSelection: false,
    auditRetentionDays: 0,
    usageExport: false,
  },
  pro: {
    servers: 25,
    boxSizes: ["small", "medium"],
    apiKeys: 5,
    members: 1,
    publishMcp: true,
    regionSelection: false,
    auditRetentionDays: 30,
    usageExport: true,
  },
  team: {
    servers: UNLIMITED,
    boxSizes: ["small", "medium", "large"],
    apiKeys: 20,
    members: 10,
    publishMcp: true,
    regionSelection: true,
    auditRetentionDays: 90,
    usageExport: true,
  },
};

/** Plan ordering, lowest → highest, for "requires at least X" gating. */
export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

/** Display labels for the three plans. */
export const PLAN_LABELS: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };

/** True when `plan` sits at or above `required` in the upgrade ladder. */
export function meetsPlan(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

/** Keys of PlanCapabilities whose value is a boolean (directly gateable). */
export type BooleanCapability = {
  [K in keyof PlanCapabilities]: PlanCapabilities[K] extends boolean ? K : never;
}[keyof PlanCapabilities];

/** Keys of PlanCapabilities whose value is a numeric limit. */
export type NumericCapability = {
  [K in keyof PlanCapabilities]: PlanCapabilities[K] extends number ? K : never;
}[keyof PlanCapabilities];

/** Whether a plan has a boolean capability (e.g. `can(plan, "publishMcp")`). */
export function can(plan: Plan, capability: BooleanCapability): boolean {
  return PLAN_CAPABILITIES[plan][capability];
}

/** Numeric limit for a plan (e.g. `limitFor(plan, "members")`). */
export function limitFor(plan: Plan, capability: NumericCapability): number {
  return PLAN_CAPABILITIES[plan][capability];
}

/** Box sizes a plan may provision. */
export function allowedBoxSizes(plan: Plan): readonly BoxSize[] {
  return PLAN_CAPABILITIES[plan].boxSizes;
}

/** Whether a plan may provision a given box size. */
export function isBoxSizeAllowed(plan: Plan, size: BoxSize): boolean {
  return PLAN_CAPABILITIES[plan].boxSizes.includes(size);
}

/** Lowest plan that may provision a given box size, or null if none can. */
export function minPlanForBoxSize(size: BoxSize): Plan | null {
  const ladder: Plan[] = ["free", "pro", "team"];
  return ladder.find((p) => PLAN_CAPABILITIES[p].boxSizes.includes(size)) ?? null;
}

// Max concurrent MCP bridges a box of each size can run before it risks OOM.
// EVERY installed MCP runs simultaneously in the box (twinmcp-docs is served by
// the control plane and does NOT count). A small box was observed to OOM around
// ~6 heavy MCPs, so caps are conservative. Overridable via env for tuning.
const MCP_CAPACITY: Record<BoxSize, number> = {
  small: Number(process.env.MAX_MCPS_SMALL ?? 4),
  medium: Number(process.env.MAX_MCPS_MEDIUM ?? 8),
  large: Number(process.env.MAX_MCPS_LARGE ?? 16),
};

/** How many box-hosted MCPs a given box size may run at once. */
export function maxMcpsForBoxSize(size: BoxSize): number {
  return MCP_CAPACITY[size] ?? 4;
}

/** Lowest plan that grants a boolean capability — used for upsell copy. */
export function minPlanFor(capability: BooleanCapability): Plan {
  const ladder: Plan[] = ["free", "pro", "team"];
  return ladder.find((p) => PLAN_CAPABILITIES[p][capability]) ?? "team";
}

/** Lowest plan whose numeric limit reaches at least `needed`, or null if no plan does. */
export function minPlanForLimit(capability: NumericCapability, needed: number): Plan | null {
  const ladder: Plan[] = ["free", "pro", "team"];
  return ladder.find((p) => PLAN_CAPABILITIES[p][capability] >= needed) ?? null;
}

/**
 * Throw this from an API route (or a helper it calls) when an action exceeds
 * the user's plan; the route is expected to catch it and map it to a 403
 * response carrying `message`. `feature` is a human-readable label for logs.
 */
export class PlanRestrictionError extends Error {
  constructor(
    public readonly feature: string,
    public readonly requiredPlan: Plan,
    message?: string
  ) {
    super(message ?? `This action requires the ${PLAN_LABELS[requiredPlan]} plan.`);
    this.name = "PlanRestrictionError";
  }
}
