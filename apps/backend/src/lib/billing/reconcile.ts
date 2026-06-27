import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import type { Plan } from "@/db/schema/core";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { enqueue } from "@/lib/queue/qstash";

/**
 * Enforce a (usually downgraded) plan's runtime limits: keep up to
 * `caps.servers` active servers whose box size the plan allows, and STOP the
 * rest — those over the count quota, plus any using a box size the plan no
 * longer permits. Oldest servers are kept first.
 *
 * Stops, never deletes: the server records remain so the user can resume or
 * upgrade. Stopping a server tears down its Upstash Box (frees paid compute).
 * Returns the ids that were enqueued for teardown.
 */
export async function reconcileServersForPlan(
  userId: string,
  plan: Plan
): Promise<{ stopped: string[] }> {
  const caps = PLAN_CAPABILITIES[plan];

  const active = await getDb()
    .select({ id: servers.id, boxSize: servers.boxSize })
    .from(servers)
    .where(and(eq(servers.userId, userId), inArray(servers.status, ["running", "provisioning"])))
    .orderBy(asc(servers.createdAt));

  const stopped: string[] = [];
  let kept = 0;
  for (const s of active) {
    const sizeAllowed = caps.boxSizes.includes(s.boxSize);
    if (sizeAllowed && kept < caps.servers) {
      kept++;
      continue;
    }
    stopped.push(s.id);
    await enqueue({ type: "destroy-server", serverId: s.id }).catch((err) =>
      console.error(`[reconcile] enqueue destroy ${s.id} failed:`, err)
    );
  }
  return { stopped };
}
