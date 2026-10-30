import type { Plan } from "@/db/schema/core";
import type { BoxSize } from "@/db/schema/platform";

/**
 * Single source of truth for what each account tier is allowed to do.
 *
 * Since 2026-10-29 TwinMCP sells no subscription: usage is paid from a prepaid
 * wallet (lib/wallet/*), and the tier only says what the account may SET UP.
 * The users.plan values are kept for backward compatibility:
 *   - "free" = "Free credit": the wallet was never funded (it runs on the €10
 *     sign-up credit, or on nothing). 1 small server, no publishing, and the
 *     compute-heavy MCPs of lib/wallet/eligibility.ts stay locked.
 *   - "pro"  = "Pay as you go": a first paid top-up (or a converted
 *     subscription) funded the wallet. 50 servers, every box size, publishing.
 *     Billing never moves an account back to "free".
 *   - "team" = grandfathered, unchanged.
 * There is no daily tool-call cap any more: the wallet balance is the limit
 * (lib/rate-limit.ts keeps only a per-minute abuse limiter).
 *
 * Both the server-side enforcement (API routes) and the dashboard read from
 * this table. ENFORCEMENT IS NOT AUTOMATIC: each capability is enforced where
 * it is used (servers → lib/quota.ts + api/v2/servers, box size → the v2
 * servers routes, api keys, members, publishing → their v2 routes).
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
  /** Tool-call activity log retention in days (metadata only — never arguments
   *  or results). Shown on the server's Activity page and enforced by the
   *  /api/cron/purge job (lib/activity/retention.ts). Available on every plan. */
  activityRetentionDays: number;
  /** May export usage metrics. */
  usageExport: boolean;
  /** May run always-on ("warm") servers that never pause — no cold start on the
   *  first request after idle. Gated additionally by the WARM_BOXES_ENABLED ops
   *  switch, since keep-alive boxes require a paid Upstash plan. */
  warmServers: boolean;
}

export const PLAN_CAPABILITIES: Record<Plan, PlanCapabilities> = {
  // "Free credit" (wallet never funded): enough to try one small server on the
  // sign-up credit. The compute-heavy MCPs are locked separately
  // (lib/wallet/eligibility.ts PROMO_EXCLUDED_MCP_SLUGS).
  free: {
    servers: 1,
    boxSizes: ["small"],
    apiKeys: 3,
    members: 1,
    publishMcp: false,
    regionSelection: false,
    auditRetentionDays: 0,
    activityRetentionDays: 7,
    usageExport: false,
    warmServers: false,
  },
  // "Pay as you go" (funded wallet): the maximum, with reasonable-use caps.
  // Members stay at 1 (team sharing isn't sold) and regionSelection stays off
  // (the runtime doesn't apply a region yet). warmServers is additionally gated
  // by the WARM_BOXES_ENABLED ops switch (see keepWarm) — never advertise it.
  pro: {
    servers: 50,
    boxSizes: ["small", "medium", "large"],
    apiKeys: 20,
    members: 1,
    publishMcp: true,
    regionSelection: false,
    auditRetentionDays: 90,
    activityRetentionDays: 90,
    usageExport: true,
    warmServers: true,
  },
  // Grandfathered: no longer sold, kept so existing Team subscribers keep working.
  team: {
    servers: UNLIMITED,
    boxSizes: ["small", "medium", "large"],
    apiKeys: 20,
    members: 10,
    publishMcp: true,
    regionSelection: true,
    auditRetentionDays: 90,
    activityRetentionDays: 90,
    usageExport: true,
    warmServers: true,
  },
};

/** Plan ordering, lowest → highest, for "requires at least X" gating. */
export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

/**
 * Display labels for the tiers (Team included, for grandfathered subscribers).
 * "free" and "pro" are wallet states now, not plans: never append "plan".
 */
export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free credit",
  pro: "Pay as you go",
  team: "Team",
};

/**
 * Tiers an account can reach today, lowest → highest ("pro" by a first paid
 * top-up). Upsell copy only ever targets these. Team is deliberately absent
 * (grandfathered).
 */
export const SELLABLE_PLANS: readonly Plan[] = ["free", "pro"];

/** Whether a tier is still reachable (Free credit or Pay as you go). False for grandfathered Team. */
export function isSellablePlan(plan: Plan): boolean {
  return SELLABLE_PLANS.includes(plan);
}

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

/**
 * Whether a server on this plan should run always-on ("warm") — never pausing,
 * so there's no cold start on the first request after idle.
 *
 * Pure so provisioning (the money path) and the dashboard UI make the SAME
 * decision. `enabled` is the WARM_BOXES_ENABLED ops switch: keep-alive boxes
 * require a paid Upstash plan, so warm boxes stay OFF until that's turned on —
 * even for funded and Team accounts. Because of that switch, never advertise always-on servers.
 * Read the switch with `process.env.WARM_BOXES_ENABLED === "true"`.
 */
export function keepWarm(plan: Plan, enabled: boolean): boolean {
  return enabled && can(plan, "warmServers");
}

/** Whether a plan may provision a given box size. */
export function isBoxSizeAllowed(plan: Plan, size: BoxSize): boolean {
  return PLAN_CAPABILITIES[plan].boxSizes.includes(size);
}

/** Lowest sellable plan that may provision a given box size, or null if none can. */
export function minPlanForBoxSize(size: BoxSize): Plan | null {
  return SELLABLE_PLANS.find((p) => PLAN_CAPABILITIES[p].boxSizes.includes(size)) ?? null;
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

/**
 * Lowest plan that grants a boolean capability — used for upsell copy.
 * Prefers a sellable plan; only a capability no sellable plan has (today:
 * regionSelection) falls back to the grandfathered ladder, so the return type
 * stays a Plan for existing callers. Check isSellablePlan() before offering it.
 */
export function minPlanFor(capability: BooleanCapability): Plan {
  const ladder: Plan[] = ["free", "pro", "team"];
  return (
    SELLABLE_PLANS.find((p) => PLAN_CAPABILITIES[p][capability]) ??
    ladder.find((p) => PLAN_CAPABILITIES[p][capability]) ??
    "team"
  );
}

/**
 * Lowest sellable plan whose numeric limit reaches at least `needed`, or null if
 * no plan you can buy does (e.g. members > 1) — callers then show no upsell.
 */
export function minPlanForLimit(capability: NumericCapability, needed: number): Plan | null {
  return SELLABLE_PLANS.find((p) => PLAN_CAPABILITIES[p][capability] >= needed) ?? null;
}

/**
 * The upsell sentence for an action the account's tier does not allow:
 * "pro" is reached by a first paid top-up, so it says so; Team (grandfathered,
 * never sold) keeps the plan wording.
 */
export function requiredTierMessage(requiredPlan: Plan, what = "This action"): string {
  if (requiredPlan === "pro") {
    return `${what} needs a funded wallet: top up your TwinMCP credit to unlock it.`;
  }
  if (requiredPlan === "free") return `${what} is available on every account.`;
  return `${what} requires the ${PLAN_LABELS[requiredPlan]} plan.`;
}

/**
 * Throw this from an API route (or a helper it calls) when an action exceeds
 * the user's tier; the route is expected to catch it and map it to a 403
 * response carrying `message`. `feature` is a human-readable label for logs.
 */
export class PlanRestrictionError extends Error {
  constructor(
    public readonly feature: string,
    public readonly requiredPlan: Plan,
    message?: string
  ) {
    super(message ?? requiredTierMessage(requiredPlan));
    this.name = "PlanRestrictionError";
  }
}
