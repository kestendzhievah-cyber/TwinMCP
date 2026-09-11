import { asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { prospects, servers, users } from "@/db/schema";
import { atRiskClients, computeClientHealth } from "./health";

// Everything that needs the founder's attention right now, in one place. Shared
// by the "À traiter" cockpit (UI) and the daily digest email so they never drift.
// Returns Date objects in memory; the cockpit API serialises them to ISO via
// NextResponse.json, the digest email formats them server-side.

const DAY = 86_400_000;

export async function computeAttention() {
  const db = getDb();
  const since24 = new Date(Date.now() - DAY);

  const [followUpsDue, newLeads, serversInError, stuckProvisioning, newSignups, health] =
    await Promise.all([
      db
        .select({
          id: prospects.id,
          company: prospects.company,
          contactName: prospects.contactName,
          email: prospects.email,
          phone: prospects.phone,
          nextActionAt: prospects.nextActionAt,
        })
        .from(prospects)
        .where(
          sql`${prospects.nextActionAt} is not null and ${prospects.nextActionAt} <= now() and ${prospects.status} not in ('won','lost')`
        )
        .orderBy(asc(prospects.nextActionAt))
        .limit(50),
      db
        .select({
          id: prospects.id,
          company: prospects.company,
          source: prospects.source,
          createdAt: prospects.createdAt,
        })
        .from(prospects)
        .where(gte(prospects.createdAt, since24))
        .orderBy(desc(prospects.createdAt))
        .limit(50),
      db
        .select({
          serverId: servers.id,
          name: servers.name,
          userId: servers.userId,
          email: users.email,
        })
        .from(servers)
        .innerJoin(users, eq(users.id, servers.userId))
        .where(eq(servers.status, "error"))
        .limit(50),
      db
        .select({
          serverId: servers.id,
          name: servers.name,
          userId: servers.userId,
          email: users.email,
          createdAt: servers.createdAt,
        })
        .from(servers)
        .innerJoin(users, eq(users.id, servers.userId))
        .where(
          sql`${servers.status} = 'provisioning' and ${servers.createdAt} < now() - interval '15 minutes'`
        )
        .limit(50),
      db
        .select({ id: users.id, email: users.email, plan: users.plan, createdAt: users.createdAt })
        .from(users)
        .where(gte(users.createdAt, since24))
        .orderBy(desc(users.createdAt))
        .limit(50),
      computeClientHealth(),
    ]);

  const clientsAtRisk = atRiskClients(health);

  const counts = {
    followUpsDue: followUpsDue.length,
    newLeads: newLeads.length,
    serversInError: serversInError.length,
    stuckProvisioning: stuckProvisioning.length,
    newSignups: newSignups.length,
    clientsAtRisk: clientsAtRisk.length,
    // "Actionable" total (new signups are informational, not an action item).
    total: followUpsDue.length + newLeads.length + serversInError.length + stuckProvisioning.length,
  };

  return {
    followUpsDue,
    newLeads,
    serversInError,
    stuckProvisioning,
    newSignups,
    clientsAtRisk,
    counts,
  };
}

export type AttentionData = Awaited<ReturnType<typeof computeAttention>>;

// Lightweight actionable count for the nav badge (4 parallel counts, no rows).
export async function attentionCount(): Promise<number> {
  const db = getDb();
  const num = sql<number>`count(*)::int`;
  const [a, b, c, d] = await Promise.all([
    db
      .select({ n: num })
      .from(prospects)
      .where(
        sql`${prospects.nextActionAt} is not null and ${prospects.nextActionAt} <= now() and ${prospects.status} not in ('won','lost')`
      ),
    db.select({ n: num }).from(servers).where(eq(servers.status, "error")),
    db
      .select({ n: num })
      .from(servers)
      .where(
        sql`${servers.status} = 'provisioning' and ${servers.createdAt} < now() - interval '15 minutes'`
      ),
    db
      .select({ n: num })
      .from(prospects)
      .where(gte(prospects.createdAt, new Date(Date.now() - DAY))),
  ]);
  return (a[0]?.n ?? 0) + (b[0]?.n ?? 0) + (c[0]?.n ?? 0) + (d[0]?.n ?? 0);
}
