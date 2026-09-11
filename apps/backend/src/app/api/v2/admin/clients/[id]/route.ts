import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  users,
  servers,
  userServers,
  mcpServers,
  apiKeys,
  auditLogs,
  usageMetrics,
} from "@/db/schema";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      stripeCustomerId: users.stripeCustomerId,
      currentPeriodEnd: users.currentPeriodEnd,
      cancelAtPeriodEnd: users.cancelAtPeriodEnd,
      onboardingCompletedAt: users.onboardingCompletedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return notFound("Client introuvable");

  const since14 = new Date(Date.now() - 14 * DAY);

  const [serverRows, mcpRows, keyRows, auditRows, usageRows] = await Promise.all([
    db
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        hostType: servers.hostType,
        boxSize: servers.boxSize,
        region: servers.region,
        status: servers.status,
        endpointUrl: servers.endpointUrl,
        lastHeartbeatAt: servers.lastHeartbeatAt,
        createdAt: servers.createdAt,
      })
      .from(servers)
      .where(eq(servers.userId, id))
      .orderBy(desc(servers.createdAt)),
    db
      .select({
        id: userServers.id,
        serverId: userServers.serverId,
        enabled: userServers.enabled,
        installedAt: userServers.installedAt,
        live: sql<boolean>`(${userServers.endpointUrl} is not null)`,
        mcpName: mcpServers.name,
        mcpSlug: mcpServers.slug,
        category: mcpServers.category,
        hostMode: mcpServers.hostMode,
      })
      .from(userServers)
      .innerJoin(mcpServers, eq(userServers.mcpServerId, mcpServers.id))
      .where(eq(userServers.userId, id))
      .orderBy(desc(userServers.installedAt)),
    db
      .select({
        prefix: apiKeys.prefix,
        name: apiKeys.name,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, id))
      .orderBy(desc(apiKeys.createdAt)),
    db
      .select({
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(25),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${usageMetrics.periodStart}), 'YYYY-MM-DD')`,
        req: sql<number>`coalesce(sum(${usageMetrics.requestCount}),0)::int`,
        err: sql<number>`coalesce(sum(${usageMetrics.errorsCount}),0)::int`,
      })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(and(eq(userServers.userId, id), gte(usageMetrics.periodStart, since14)))
      .groupBy(sql`date_trunc('day', ${usageMetrics.periodStart})`)
      .orderBy(sql`date_trunc('day', ${usageMetrics.periodStart})`),
  ]);

  return NextResponse.json({
    user,
    servers: serverRows,
    mcps: mcpRows,
    apiKeys: keyRows,
    audit: auditRows,
    usage14d: usageRows,
  });
}
