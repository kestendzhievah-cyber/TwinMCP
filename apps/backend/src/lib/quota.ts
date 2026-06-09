import { eq, and, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import type { Plan } from "@/db/schema/core";
import { PLAN_CAPABILITIES } from "./plan-features";

// Derived from the central capability table so the server limit lives in one
// place (see lib/plan-features.ts). Kept as a named export for existing callers.
export const SERVER_QUOTAS: Record<Plan, number> = {
  free: PLAN_CAPABILITIES.free.servers,
  pro: PLAN_CAPABILITIES.pro.servers,
  team: PLAN_CAPABILITIES.team.servers,
};

export class QuotaExceededError extends Error {
  constructor(public readonly resource: string, public readonly limit: number) {
    super(`Quota exceeded: ${resource} (limit ${limit})`);
    this.name = "QuotaExceededError";
  }
}

export async function assertServerQuota(userId: string, plan: Plan): Promise<void> {
  const limit = SERVER_QUOTAS[plan];
  if (limit === Number.POSITIVE_INFINITY) return;

  const rows = await getDb()
    .select({ id: servers.id })
    .from(servers)
    .where(and(eq(servers.userId, userId), ne(servers.status, "destroyed")));

  if (rows.length >= limit) {
    throw new QuotaExceededError("servers", limit);
  }
}
