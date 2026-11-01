import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { and, desc, eq } from "drizzle-orm";
import { Activity, AlertTriangle, ArrowRight, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema/core";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { toolCallStatuses, type ToolCallStatus } from "@/db/schema/activity";
import {
  hasActiveFilters,
  listServerToolCalls,
  parseActivityQuery,
  type ActivityFilters,
  type ActivityPage,
} from "@/lib/activity/query";
import { ACTIVITY_RETENTION_DAYS } from "@/lib/activity/retention";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, fieldClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServerHeader } from "../server-header";
import { CopyRequestId } from "./copy-request-id";
import { getEntitlements } from "@/lib/wallet/entitlements";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ToolCallStatus, string> = {
  ok: "OK",
  error: "Error",
  denied: "Denied",
  rate_limited: "Rate limited",
};

const STATUS_VARIANT: Record<ToolCallStatus, NonNullable<BadgeProps["variant"]>> = {
  ok: "success",
  error: "destructive",
  denied: "warning",
  rate_limited: "info",
};

// Server-rendered only, fixed locale + UTC: the ledger reads the same everywhere.
const TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

// A native select dressed as the Input field (a GET form needs no client JS).
const selectClass = cn(fieldClasses, "flex h-10 py-2");
const fieldLabel = "text-xs font-medium text-muted-foreground";

function queryString(filters: ActivityFilters, cursor?: string | null): string {
  const p = new URLSearchParams();
  if (filters.status) p.set("status", filters.status);
  if (filters.mcp) p.set("mcp", filters.mcp);
  if (filters.tool) p.set("tool", filters.tool);
  if (filters.apiKeyId) p.set("apiKey", filters.apiKeyId);
  if (cursor) p.set("cursor", cursor);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function ServerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [[srv], ent, installed, keys] = await Promise.all([
    db
      .select({ id: servers.id, name: servers.name, slug: servers.slug })
      .from(servers)
      .where(and(eq(servers.id, id), eq(servers.userId, user.id)))
      .limit(1),
    getEntitlements(user.id),
    db
      .select({ slug: mcpServers.slug, name: mcpServers.name })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(and(eq(userServers.serverId, id), eq(userServers.userId, user.id))),
    db
      .select({ id: apiKeys.id, prefix: apiKeys.prefix, name: apiKeys.name })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt))
      .limit(50),
  ]);
  if (!srv) notFound();

  const plan = ent?.tier ?? "free";
  const base = `/dashboard/servers/${srv.id}/activity`;
  const parsed = parseActivityQuery(sp);

  let result: ActivityPage | null = null;
  let filters: ActivityFilters = {};
  if (parsed.ok) {
    filters = parsed.query.filters;
    result = await listServerToolCalls({
      userId: user.id,
      serverId: srv.id,
      plan,
      query: parsed.query,
    });
  }
  const retentionDays = result?.retentionDays ?? ACTIVITY_RETENTION_DAYS[plan];
  const proDays = ACTIVITY_RETENTION_DAYS.pro;
  const filtered = hasActiveFilters(filters);
  const onFirstPage = !(parsed.ok && parsed.query.cursor);

  // The MCP filter lists what is installed, plus a slug from the URL that is
  // no longer installed (its history is still there).
  const mcpOptions = [...installed].sort((a, b) => a.slug.localeCompare(b.slug));
  if (filters.mcp && !mcpOptions.some((m) => m.slug === filters.mcp)) {
    mcpOptions.push({ slug: filters.mcp, name: filters.mcp });
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <ServerHeader serverId={srv.id} name={srv.name} slug={srv.slug} />

      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">Activity</h2>
        <p className="text-sm text-muted-foreground">
          Every tool call through this server&apos;s MCP endpoints, newest first, kept{" "}
          <span className="tabular-nums">{retentionDays}</span> days on your account.
          {plan === "free" && retentionDays < proDays && (
            <>
              {" "}
              <Link
                href={"/dashboard/billing" as Route}
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                A first top-up keeps <span className="tabular-nums">{proDays}</span> days
              </Link>
              .
            </>
          )}
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-success" />
          Metadata only — arguments and results are never stored.
        </p>
      </div>

      {/* Filters: a plain GET form, so a filtered view is a shareable URL. */}
      <form
        method="get"
        action={base}
        className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="f-status" className={fieldLabel}>
            Status
          </Label>
          <select
            id="f-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={selectClass}
          >
            <option value="">All</option>
            {toolCallStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-mcp" className={fieldLabel}>
            MCP
          </Label>
          <select id="f-mcp" name="mcp" defaultValue={filters.mcp ?? ""} className={selectClass}>
            <option value="">All</option>
            {mcpOptions.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-tool" className={fieldLabel}>
            Tool
          </Label>
          <Input
            id="f-tool"
            name="tool"
            placeholder="Exact tool name"
            defaultValue={filters.tool ?? ""}
            className="font-mono"
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-key" className={fieldLabel}>
            API key
          </Label>
          <select
            id="f-key"
            name="apiKey"
            defaultValue={filters.apiKeyId ?? ""}
            className={selectClass}
          >
            <option value="">All</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name ? `${k.name} · ${k.prefix}` : k.prefix}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            Apply
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href={base as Route}>Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {!parsed.ok ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {parsed.error}{" "}
            <Link href={base as Route} className="underline underline-offset-4">
              Back to the newest calls
            </Link>
            .
          </p>
        </div>
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={
            filtered
              ? "No tool calls match these filters"
              : onFirstPage
                ? "No tool calls yet"
                : "No older tool calls"
          }
          description={
            filtered
              ? "Try another status, MCP, tool or key — or clear the filters. Metadata only — arguments and results are never stored."
              : "Each tool call through this server's endpoint appears here with its MCP, tool, status, latency and request id. Metadata only — arguments and results are never stored."
          }
          primaryAction={
            filtered || !onFirstPage ? (
              <Button asChild variant="outline">
                <Link href={base as Route}>
                  <RotateCcw className="h-4 w-4" />
                  Newest calls
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        // The call log: tabular timestamps, slugs and ids in mono, the outcome
        // as a tinted pill. Scrolls sideways inside its frame on phones.
        <Table containerClassName="shadow-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Time (UTC)</TableHead>
              <TableHead>MCP</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-24 text-right">Latency</TableHead>
              <TableHead className="w-32">Key</TableHead>
              <TableHead className="w-44">Request id</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {TIME.format(new Date(r.createdAt))}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.mcpSlug}</TableCell>
                <TableCell className="break-all font-mono text-xs">
                  {r.toolName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                      {r.status === "error" && <XCircle aria-hidden className="h-3 w-3" />}
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {r.errorCode !== null && (
                      <span className="font-mono text-xs text-muted-foreground">{r.errorCode}</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                  {formatLatency(r.latencyMs)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.apiKeyPrefix ??
                    (r.oauthClientName ? (
                      <span className="font-sans" title={r.apiKeyId ?? undefined}>
                        OAuth · {r.oauthClientName}
                      </span>
                    ) : r.apiKeyId ? (
                      // Not one of your current keys (nor a live connector grant).
                      <span className="font-sans" title={r.apiKeyId}>
                        Deleted key
                      </span>
                    ) : (
                      "—"
                    ))}
                  {r.externalUserId && (
                    <span className="block break-all" title="External user">
                      {r.externalUserId}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <CopyRequestId requestId={r.requestId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {parsed.ok && (!onFirstPage || result?.nextCursor) && (
        // Pager: keyset pagination only walks forward; "Newest" restarts.
        <div className="flex items-center justify-between border-t border-border pt-4">
          {!onFirstPage ? (
            <Button asChild variant="outline">
              <Link href={`${base}${queryString(filters)}` as Route}>
                <RotateCcw className="h-4 w-4" />
                Newest
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {result?.nextCursor ? (
            <Button asChild variant="outline">
              <Link href={`${base}${queryString(filters, result.nextCursor)}` as Route}>
                Older
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Older
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
