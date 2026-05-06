import { eq, and, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import type { Plan } from "@/db/schema/core";

export const SERVER_QUOTAS: Record<Plan, number> = {
  free: 1,
  pro: 25,
  team: Number.POSITIVE_INFINITY,
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
