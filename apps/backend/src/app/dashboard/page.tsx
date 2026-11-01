import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, Boxes, Plus, Server } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { apiKeys, mcpServers, servers, usageMetrics, userServers, users } from "@/db/schema";
import type { BoxSize, HostType, ServerStatus } from "@/db/schema/platform";
import { and, asc, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { SERVER_QUOTAS } from "@/lib/quota";
import { entitlementTier, PLAN_CAPABILITIES } from "@/lib/plan-features";
import {
  computeWalletNudge,
  formatCredit,
  LOW_BALANCE_MICROS,
  type NudgeLevel,
  type WalletNudge,
} from "@/lib/billing/upgrade-state";
import { loadWalletSignals } from "@/lib/billing/upgrade-signals";
import { sumLedgerSince } from "@/lib/wallet/ledger";
import { countsTowardKeyLimit, isKeyUsable } from "@/lib/auth/key-scope";
import { lifecycleLabel } from "@/lib/server-lifecycle-label";
import { formatDate } from "@/lib/format";
import { eurToMicros, PRICING } from "@/lib/wallet/pricing";
import { cn } from "@/lib/utils";
import { ApiKeysPanel } from "./api-keys-panel";
import { TopUpInline, TopUpLink } from "@/components/billing/top-up-inline";
import { CreditMeter } from "@/components/billing/credit-meter";
import {
  balanceTone,
  daysLeftLabel,
  promoShare,
  TONE_FIGURE,
  TONE_SURFACE,
  type BalanceTone,
} from "@/components/billing/balance-tone";
import { FUNDED_UNLOCKS, walletFacts } from "@/components/pricing/wallet-copy";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ActivationChecklist,
  isActivated,
  type ActivationState,
} from "@/components/dashboard/activation-checklist";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";

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

interface ServerRow {
  id: string;
  name: string;
  slug: string;
  status: ServerStatus;
  hostType: HostType;
  boxId: string | null;
  boxSize: BoxSize;
  createdAt: Date;
}

/** The five most recent live servers, for the summary table (null: read failed). */
async function loadRecentServers(userId: string): Promise<ServerRow[] | null> {
  try {
    return await getDb()
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        status: servers.status,
        hostType: servers.hostType,
        boxId: servers.boxId,
        boxSize: servers.boxSize,
        createdAt: servers.createdAt,
      })
      .from(servers)
      .where(and(eq(servers.userId, userId), ne(servers.status, "destroyed")))
      .orderBy(desc(servers.createdAt))
      .limit(5);
  } catch (err) {
    console.warn("[dashboard] servers summary unavailable:", err);
    return null;
  }
}

/** Levels at which the wallet interrupts: the layout strip then holds the rose top-up. */
const URGENT_LEVELS: ReadonlySet<NudgeLevel> = new Set<NudgeLevel>([
  "warning",
  "limit",
  "past_due",
]);

const FACTS = walletFacts("en");
const SIGNUP_MICROS = eurToMicros(PRICING.signupCreditEur);
const eur = (micros: number) => formatCredit(micros, { precise: false });

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // The wallet signals (balance, free credit, live servers, a legacy
  // subscription) are the same the layout loads — React cache makes it one
  // set of queries per request. The keys, the recent servers and the week's
  // spend are specific to this page; the spend and the servers are best
  // effort (null hides them).
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [signals, keyRows, activationRaw, spent7d, recentServers] = await Promise.all([
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
    loadRecentServers(user.id),
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

  // The same decision as the layout strip and the sidebar balance card
  // (lib/billing/upgrade-state.ts), so every surface speaks with one voice.
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
  const urgent = signals.walletAvailable && URGENT_LEVELS.has(nudge.level);
  // The nudge identity the overview's credit CTA has always reported.
  const ctaIdentity: { level: NudgeLevel; reason: string } = balanceLevel
    ? { level: balanceLevel, reason: balanceLevel === "limit" ? "zero_balance" : "low_balance" }
    : { level: nudge.level, reason: nudge.reason };

  // One rose primary per screen. When the wallet interrupts, the layout
  // strip holds it; otherwise the next setup step; then a first top-up for a
  // free-credit account that used its server; else "Create server".
  const checklistOpen = activation !== null && !isActivated(activation);
  const primary: "strip" | "checklist" | "topup" | "create" = urgent
    ? "strip"
    : checklistOpen
      ? "checklist"
      : !funded && atServerLimit
        ? "topup"
        : "create";

  const tone: BalanceTone | null = signals.walletAvailable
    ? balanceTone({ level: nudge.level, funded, promoMicros: signals.promoMicros })
    : null;

  const createServer = (
    <Button asChild variant={primary === "create" ? "default" : "outline"}>
      <Link href={"/dashboard/servers" as Route}>
        <Plus className="h-4 w-4" />
        Create server
      </Link>
    </Button>
  );

  const creditCard = (
    <CreditCard
      className={checklistOpen ? "lg:col-span-2" : undefined}
      tone={tone}
      nudge={nudge}
      promoMicros={signals.promoMicros}
      paidMicros={signals.paidMicros}
      funded={funded}
      autoRecharge={Boolean(signals.autoRechargeEnabled)}
      spent7d={spent7d}
      urgent={urgent}
      cta={
        urgent || !signals.walletAvailable ? null : (
          <TopUpLink
            source="overview"
            level={ctaIdentity.level}
            reason={ctaIdentity.reason}
            label="Top up"
            className={cn(
              buttonVariants({ variant: primary === "topup" ? "default" : "outline" }),
              "w-full hover:no-underline sm:w-auto"
            )}
          />
        )
      }
    />
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Welcome back"
        description="Your credit, your servers and your API keys at a glance."
        actions={createServer}
      />

      {/* Row 2: the credit card beside the setup checklist (until the first
          tool call), then a one-line success strip once every step is done. */}
      {checklistOpen && activation ? (
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          {creditCard}
          <ActivationChecklist state={activation} primary={primary === "checklist"} />
        </div>
      ) : (
        <div className="space-y-4">
          {activation && <ActivationChecklist state={activation} />}
          {creditCard}
        </div>
      )}

      {/* Low or used-up balance: quick amounts straight to the Credits page. */}
      {urgent && (
        <TopUpInline
          source="overview"
          level={ctaIdentity.level}
          reason={ctaIdentity.reason}
          description={
            ctaIdentity.level === "limit"
              ? "Tool calls are refused. Quick top-up:"
              : "Quick top-up:"
          }
          presetsEur={PRICING.topupPresetsEur}
        />
      )}

      {/* Row 3: the latest servers. */}
      {recentServers !== null && recentServers.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No servers yet"
          description={
            funded
              ? "Create one and it’s live in a couple of minutes."
              : "Create one and it’s live in a couple of minutes, on your free credit."
          }
          primaryAction={createServer}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle as="h2">Servers</CardTitle>
              <CardDescription className="tabular-nums">
                {serverCount} of {serverLimitLabel} in use
                {atServerLimit && ` · up to ${PLAN_CAPABILITIES.pro.servers} with paid credit · `}
                {atServerLimit && (
                  <TopUpLink
                    source="overview"
                    level="offer"
                    reason="servers_limit"
                    label="Add credit"
                  />
                )}
              </CardDescription>
            </div>
            <Link
              href={"/dashboard/servers" as Route}
              className="inline-flex min-h-10 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          {recentServers === null ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your servers could not be loaded. Refresh the page in a moment.
              </p>
            </CardContent>
          ) : (
            <div className="border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5 sm:pl-6">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Size</TableHead>
                    <TableHead className="hidden pr-5 sm:table-cell sm:pr-6">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentServers.map((s) => {
                    const view = lifecycleLabel(s);
                    const statusBadge = (
                      <Badge
                        variant={view.variant}
                        title={view.help}
                        className="max-w-full whitespace-normal"
                      >
                        {view.variant === "destructive" && (
                          <AlertTriangle aria-hidden className="h-3 w-3 shrink-0" />
                        )}
                        {view.label}
                      </Badge>
                    );
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="pl-5 pr-5 sm:pl-6 sm:pr-4">
                          <Link
                            href={`/dashboard/servers/${s.id}` as Route}
                            className="inline-flex items-center gap-2 font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline"
                          >
                            <Server
                              aria-hidden
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                            />
                            <span className="max-w-[12rem] truncate sm:max-w-none">{s.name}</span>
                          </Link>
                          <div
                            className="mt-0.5 max-w-[12rem] truncate font-mono text-xs text-muted-foreground"
                            title={s.slug}
                          >
                            {s.slug}
                          </div>
                          {/* Phones: one stacked column, the status under the name. */}
                          <div className="mt-2 sm:hidden">{statusBadge}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{statusBadge}</TableCell>
                        <TableCell className="hidden capitalize sm:table-cell">
                          {s.boxSize}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap pr-5 text-muted-foreground sm:table-cell sm:pr-6">
                          {formatDate(s.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Row 5: API keys, in a collapsible card (open while there is none). */}
      <ApiKeysPanel
        plan={plan}
        defaultOpen={keys.length === 0}
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

/**
 * The overview credit card. Free credit: the soft-pink offer card with the
 * figure, what is left of the sign-up credit and the days to go. Funded: a
 * neutral card with the balance and the auto-recharge status. Low or used up:
 * the status tint and the nudge headline (the strip above says the rest).
 */
function CreditCard({
  className,
  tone,
  nudge,
  promoMicros,
  paidMicros,
  funded,
  autoRecharge,
  spent7d,
  urgent,
  cta,
}: {
  className?: string;
  /** null: the wallet could not be read. */
  tone: BalanceTone | null;
  nudge: WalletNudge;
  promoMicros: number;
  paidMicros: number;
  funded: boolean;
  autoRecharge: boolean;
  spent7d: number | null;
  urgent: boolean;
  cta: React.ReactNode;
}) {
  const total = nudge.totalMicros;
  const promo = tone === "promo";
  const days = daysLeftLabel(nudge.promoDaysLeft);

  return (
    <Card
      className={cn("flex flex-col", tone && tone !== "neutral" && TONE_SURFACE[tone], className)}
    >
      <CardContent className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold",
                tone === "promo" && "text-offer-foreground",
                tone === "warning" && "text-warning",
                tone === "danger" && "text-destructive",
                (tone === "neutral" || tone === null) && "text-muted-foreground"
              )}
            >
              {urgent && <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />}
              {urgent ? nudge.headline : promo ? "Free credit" : "Balance"}
            </p>
            {tone ? (
              <p
                className={cn(
                  "font-display text-4xl font-bold leading-tight tracking-tight tabular-nums",
                  TONE_FIGURE[tone]
                )}
              >
                {eur(promo ? promoMicros : total)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your balance could not be loaded. Refresh the page in a moment.
              </p>
            )}
            {promo && (
              <p className="text-sm tabular-nums text-offer-foreground">
                of {FACTS.signupCredit}
                {days && ` · ${days}`}
                {nudge.promoExpiresAt && ` · until ${formatDate(nudge.promoExpiresAt)}`}
                {paidMicros > 0 && ` · balance ${eur(total)}`}
              </p>
            )}
            {tone === "neutral" && promoMicros > 0 && nudge.promoDaysLeft !== null && (
              <p className="text-sm tabular-nums text-muted-foreground">
                Includes {eur(promoMicros)} of free credit · {days}
              </p>
            )}
          </div>
          {cta}
        </div>

        {promo && (
          <div className="space-y-3">
            <CreditMeter
              share={promoShare(promoMicros, SIGNUP_MICROS)}
              label="Free credit left"
              className="h-2"
            />
            <p className="text-sm text-muted-foreground">{nudge.body || FUNDED_UNLOCKS.en}</p>
          </div>
        )}

        {tone === "neutral" && funded && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={autoRecharge ? "success" : "secondary"}>
              Auto-recharge {autoRecharge ? "on" : "off"}
            </Badge>
            {autoRecharge
              ? "Your saved card refills the balance below your threshold."
              : "Turn it on in Credits to never run out."}
          </p>
        )}

        <div
          className={cn(
            "mt-auto flex flex-wrap items-baseline justify-between gap-2 border-t pt-4 text-sm",
            promo ? "border-offer-border" : "border-border"
          )}
        >
          <span className="text-muted-foreground">
            Spent in the last 7 days{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {spent7d === null ? "—" : eur(spent7d)}
            </span>
          </span>
          <Link
            href={"/dashboard/usage" as Route}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Usage details
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
