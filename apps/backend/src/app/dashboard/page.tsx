import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { apiKeys, usageMetrics, userServers, users, servers } from "@/db/schema";
import { and, count, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { getDailyLimit } from "@/lib/rate-limit";
import { SERVER_QUOTAS } from "@/lib/quota";
import { ApiKeysPanel } from "./api-keys-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // Today's MCP requests are what the daily rate limit governs — count them from
  // usage_metrics (per UTC day), matching the Usage page, not usage_events.
  const now = new Date();
  const utcDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Independent queries — run them concurrently instead of in a waterfall.
  const [userRows, keys, usageRows, serverRows] = await Promise.all([
    db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id)).limit(1),
    db
      .select({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        name: apiKeys.name,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt)),
    db
      .select({ n: sql<number>`coalesce(sum(${usageMetrics.requestCount}), 0)::int` })
      .from(usageMetrics)
      .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
      .where(and(eq(userServers.userId, user.id), gte(usageMetrics.periodStart, utcDayStart))),
    db
      .select({ n: count() })
      .from(servers)
      .where(and(eq(servers.userId, user.id), ne(servers.status, "destroyed"))),
  ]);

  const plan = userRows[0]?.plan ?? "free";
  const usageCount = usageRows[0];

  const limit = getDailyLimit(plan);
  const used = usageCount?.n ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const serverCount = serverRows[0]?.n ?? 0;
  const serverLimit = SERVER_QUOTAS[plan];
  const serverLimitLabel = serverLimit === Number.POSITIVE_INFINITY ? "∞" : serverLimit.toString();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and API keys.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-2xl capitalize flex items-center gap-2">
              {plan}
              {plan === "pro" && <Badge variant="success">Active</Badge>}
              {plan === "team" && <Badge variant="success">Active</Badge>}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>MCP requests today</CardDescription>
            <CardTitle className="text-2xl">
              {used.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {limit.toLocaleString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Servers</CardDescription>
            <CardTitle className="text-2xl">
              {serverCount}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {serverLimitLabel}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <ApiKeysPanel
        plan={plan}
        keys={keys.map((k) => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
