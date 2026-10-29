import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { apiKeys, mcpServers, servers, usageMetrics, userServers, users } from "@/db/schema";
import { and, asc, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { SERVER_QUOTAS } from "@/lib/quota";
import { PLAN_CAPABILITIES, PLAN_LABELS } from "@/lib/plan-features";
import { computeUpgradeNudge, trialCta, WARN_PCT } from "@/lib/billing/upgrade-state";
import { loadUpgradeSignals } from "@/lib/billing/upgrade-signals";
import { formatDate } from "@/lib/format";
import { countsTowardKeyLimit, isKeyUsable } from "@/lib/auth/key-scope";
import { cn } from "@/lib/utils";
import { ApiKeysPanel } from "./api-keys-panel";
import { UpgradeInline, UpgradeLink } from "@/components/billing/upgrade-inline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ActivationChecklist,
  type ActivationState,
} from "@/components/dashboard/activation-checklist";

/**
 * The activation checklist's flags, from the DB. Best effort: a failed query
 * hides the checklist rather than 500ing the overview.
 */
async function loadActivation(userId: string): Promise<ActivationState | null> {
  const db = getDb();
  try {
    const [[firstServer], [mcp], [usedKey], [me], [usage]] = await Promise.all([
      db
        .select({ id: servers.id })
        .from(servers)
        .where(and(eq(servers.userId, userId), ne(servers.status, "destroyed")))
        .orderBy(asc(servers.createdAt))
        .limit(1),
      db
        .select({ id: userServers.id })
        .from(userServers)
        .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
        .where(and(eq(userServers.userId, userId), ne(mcpServers.slug, TWINMCP_DOCS_SLUG)))
        .limit(1),
      db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, userId), isNotNull(apiKeys.lastUsedAt)))
        .limit(1),
      db
        .select({ firstToolCallAt: sql<string | null>`${users.metadata}->>'firstToolCallAt'` })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db
        .select({ id: usageMetrics.id })
        .from(usageMetrics)
        .innerJoin(userServers, eq(usageMetrics.userServerId, userServers.id))
        .where(and(eq(userServers.userId, userId), gt(usageMetrics.requestCount, 0)))
        .limit(1),
    ]);
    return {
      hasServer: Boolean(firstServer),
      hasMcp: Boolean(mcp),
      hasKey: false, // set by the caller from the active keys it already loads
      ideConnected: Boolean(usedKey),
      firstToolCall: Boolean(me?.firstToolCallAt) || Boolean(usage),
      serverId: firstServer?.id ?? null,
    };
  } catch (err) {
    console.warn("[dashboard] activation checklist unavailable:", err);
    return null;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // The upgrade signals (today's tool calls per UTC day, live servers, the
  // subscription mirror) are the same the layout loads — React cache makes it
  // one set of queries per request. Only the keys are specific to this page.
  const [signals, keyRows, activationRaw] = await Promise.all([
    loadUpgradeSignals(user.id),
    db
      .select({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        name: apiKeys.name,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt)),
    loadActivation(user.id),
  ]);
  // Revoked keys are filtered in SQL; a key past its expiry (the old half of a
  // rotation) no longer works, so it is not listed either. The plan slots, the
  // keys nudge and the checklist's "API key" step only count keys that hold a
  // slot (lib/auth/key-scope.ts): a replaced key in its rotation overlap does
  // not, its replacement does.
  const now = Date.now();
  const keys = keyRows.filter((k) => isKeyUsable({ revokedAt: null, expiresAt: k.expiresAt }, now));
  const keyCount = keys.filter((k) =>
    countsTowardKeyLimit({ revokedAt: null, expiresAt: k.expiresAt }, now)
  ).length;
  const activation = activationRaw ? { ...activationRaw, hasKey: keyCount > 0 } : null;

  const { plan, proDailyLimit, serverCount } = signals;
  const limit = signals.dailyLimit;
  const used = signals.usedToday;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const serverLimit = SERVER_QUOTAS[plan];
  const serverLimitLabel = serverLimit === Number.POSITIVE_INFINITY ? "∞" : serverLimit.toString();

  // The same decision as the layout strip (lib/billing/upgrade-state.ts), so
  // the plan card, the quota card and the servers card speak with one voice.
  const nudge = computeUpgradeNudge({ ...signals, keyCount });
  const isFree = plan === "free";
  const cta = trialCta(nudge.trialEligible);
  const quotaLevel = !isFree ? null : pct >= 100 ? "limit" : pct >= WARN_PCT ? "warning" : null;
  const atServerLimit = isFree && serverCount >= serverLimit;

  return (
    <div className="space-y-8">
      {/* Page header (DESIGN.md §5): the engraved title, one italic line, the double rule. */}
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Overview</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Manage your account and API keys.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>

      {/* Until the first tool call: the five steps to get there (renders nothing once done). */}
      {activation && <ActivationChecklist state={activation} />}

      {/* Stat cards (DESIGN.md §5): small-caps caption, lining figure over its limit. */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Current plan
            </CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-3 text-3xl">
              {PLAN_LABELS[plan]}
              {!isFree &&
                (nudge.trialEndsAt ? (
                  <Badge variant="info" className="lining">
                    Trial · ends {formatDate(nudge.trialEndsAt)}
                  </Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                ))}
            </CardTitle>
          </CardHeader>
          {isFree && (
            <CardContent>
              <UpgradeLink
                source="overview"
                level={nudge.level}
                reason={nudge.reason}
                label={nudge.cta.label}
                className="text-sm"
              />
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Tool calls today
            </CardDescription>
            <CardTitle className="lining text-3xl">
              {used.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {limit.toLocaleString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* The quota bar: a hairline of ink on stock; ochre near the limit, oxblood at it. */}
            <div className="h-1.5 w-full overflow-hidden bg-secondary">
              <div
                className={cn(
                  "h-full transition-all",
                  pct >= 100 ? "bg-destructive" : pct >= WARN_PCT ? "bg-warning" : "bg-foreground"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs italic text-muted-foreground">Resets at midnight UTC</p>
            {quotaLevel && (
              <UpgradeInline
                source="overview"
                level={quotaLevel}
                reason={quotaLevel === "limit" ? "quota_limit" : "quota_warning"}
                label={cta.label}
                description={`Pro: ${proDailyLimit.toLocaleString("en-US")} a day`}
                className="lining text-xs"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Servers
            </CardDescription>
            <CardTitle className="lining text-3xl">
              {serverCount}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {serverLimitLabel}
                {atServerLimit && ` · Pro: ${PLAN_CAPABILITIES.pro.servers}`}
              </span>
            </CardTitle>
          </CardHeader>
          {atServerLimit && (
            <CardContent>
              <UpgradeLink
                source="overview"
                level="offer"
                reason="servers_limit"
                label={cta.label}
                className="text-sm"
              />
            </CardContent>
          )}
        </Card>
      </div>

      <ApiKeysPanel
        plan={plan}
        trialEligible={nudge.trialEligible}
        keys={keys.map((k) => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
          expiresAt: k.expiresAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
