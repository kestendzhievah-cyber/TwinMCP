import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { apiKeys, mcpServers, servers, usageMetrics, userServers, users } from "@/db/schema";
import { and, asc, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { SERVER_QUOTAS } from "@/lib/quota";
import { entitlementTier, PLAN_CAPABILITIES } from "@/lib/plan-features";
import {
  computeWalletNudge,
  expiryCountdown,
  formatCredit,
  LOW_BALANCE_MICROS,
} from "@/lib/billing/upgrade-state";
import { loadWalletSignals } from "@/lib/billing/upgrade-signals";
import { sumLedgerSince } from "@/lib/wallet/ledger";
import { countsTowardKeyLimit, isKeyUsable } from "@/lib/auth/key-scope";
import { cn } from "@/lib/utils";
import { ApiKeysPanel } from "./api-keys-panel";
import { TopUpInline, TopUpLink } from "@/components/billing/top-up-inline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  // The wallet signals (balance, free credit, live servers, a legacy
  // subscription) are the same the layout loads — React cache makes it one
  // set of queries per request. The keys and the week's spend are specific
  // to this page; the spend is best effort (null hides the figure).
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [signals, keyRows, activationRaw, spent7d] = await Promise.all([
    loadWalletSignals(user.id),
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
    sumLedgerSince(user.id, ["usage_tool_call", "usage_compute"], weekAgo)
      .then((sum) => -sum)
      .catch((err: unknown) => {
        console.warn("[dashboard] weekly spend unavailable:", err);
        return null;
      }),
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

  const { serverCount, funded } = signals;
  // The tier comes from the wallet (funded), never users.plan alone, so the
  // limits shown match what the API gates allow.
  const plan = entitlementTier(signals.plan, funded);
  const serverLimit = SERVER_QUOTAS[plan];
  const serverLimitLabel = serverLimit === Number.POSITIVE_INFINITY ? "∞" : serverLimit.toString();

  // The same decision as the layout strip (lib/billing/upgrade-state.ts), so
  // the credit card and the servers card speak with one voice.
  const nudge = computeWalletNudge({ ...signals, keyCount });
  const total = nudge.totalMicros;
  const atServerLimit = !funded && serverCount >= serverLimit;
  const balanceLevel = !signals.walletAvailable
    ? null
    : total <= 0
      ? "limit"
      : total < LOW_BALANCE_MICROS
        ? "warning"
        : null;

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

      {/* Stat cards (DESIGN.md §5): small-caps caption, lining figure, italic footnote. */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Credit
            </CardDescription>
            <CardTitle
              className={cn(
                "lining text-3xl",
                balanceLevel === "limit" && "text-destructive",
                balanceLevel === "warning" && "text-warning"
              )}
            >
              {signals.walletAvailable ? formatCredit(total, { precise: false }) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nudge.promoExpiresAt && (
              <p className="lining text-xs italic text-muted-foreground">
                {formatCredit(signals.promoMicros, { precise: false })} of free credit, expires{" "}
                {expiryCountdown(nudge.promoExpiresAt, signals.now)}
              </p>
            )}
            {balanceLevel ? (
              <TopUpInline
                source="overview"
                level={balanceLevel}
                reason={balanceLevel === "limit" ? "zero_balance" : "low_balance"}
                description={balanceLevel === "limit" ? "Tool calls are refused." : "Running low."}
                className="lining text-xs"
              />
            ) : (
              signals.walletAvailable && (
                <TopUpLink
                  source="overview"
                  level={nudge.level}
                  reason={nudge.reason}
                  label={funded ? "Add credit" : "Add credit to unlock everything"}
                  className="text-sm"
                />
              )
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Spent · last 7 days
            </CardDescription>
            <CardTitle className="lining text-3xl">
              {spent7d === null ? "—" : formatCredit(spent7d, { precise: false })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs italic text-muted-foreground">
              Tool calls and server CPU time. Details on the Usage page.
            </p>
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
                {atServerLimit && ` · with paid credit: ${PLAN_CAPABILITIES.pro.servers}`}
              </span>
            </CardTitle>
          </CardHeader>
          {atServerLimit && (
            <CardContent>
              <TopUpLink
                source="overview"
                level="offer"
                reason="servers_limit"
                label="Add credit"
                className="text-sm"
              />
            </CardContent>
          )}
        </Card>
      </div>

      <ApiKeysPanel
        plan={plan}
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
