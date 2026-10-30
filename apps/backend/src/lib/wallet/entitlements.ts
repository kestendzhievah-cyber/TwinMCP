import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { walletAccounts } from "@/db/schema/wallet";
import { resolveEntitlements, type Entitlements } from "@/lib/plan-features";

export type { Entitlements } from "@/lib/plan-features";

// Server-only: what an account may SET UP (server count, box sizes,
// publishing MCPs, the promo restrictions), derived from the WALLET.
//
// funded = wallet_accounts.funded_at is set OR a legacy subscription is still
// being paid (active / past_due). users.plan is read only to tell a funded
// grandfathered Team account apart, and is returned as `displayPlan` for
// display and analytics. A never-paid row with plan='pro' (a lapsed trial)
// therefore gets the Free-credit limits without any SQL clean-up.
//
// Every server-side gate calls this; the client is never trusted with it.

/**
 * The account's entitlements, or null when the user row does not exist.
 * Throws on a database error: callers are API routes / jobs that already turn
 * an exception into a 500 or a retry, so a gate never fails OPEN.
 */
export async function getEntitlements(userId: string): Promise<Entitlements | null> {
  const [row] = await getDb()
    .select({
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      fundedAt: walletAccounts.fundedAt,
    })
    .from(users)
    .leftJoin(walletAccounts, eq(walletAccounts.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  return resolveEntitlements({
    plan: row.plan,
    fundedAt: row.fundedAt ?? null,
    subscriptionStatus: row.subscriptionStatus ?? null,
  });
}
