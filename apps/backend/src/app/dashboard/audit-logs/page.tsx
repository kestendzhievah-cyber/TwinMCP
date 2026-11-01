import Link from "next/link";
import type { Route } from "next";
import { and, asc, desc, eq, gte, ilike, type SQL } from "drizzle-orm";
import { ArrowLeft, ArrowRight, ScrollText, Search } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import { FundedCard } from "@/components/billing/funded-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, fieldClasses } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEntitlements } from "@/lib/wallet/entitlements";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const BASE = "/dashboard/audit-logs";

/** Escape LIKE wildcards so the search box matches the text literally. */
function likeContains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The page URL with the active filters kept (pager links, "Clear"). */
function pageHref(page: number, q: string, target: string): Route {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (target) params.set("target", target);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `${BASE}?${qs}` : BASE) as Route;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; target?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // Filter bar values (GET form): an action search and a target-type pick.
  const q = (sp.q ?? "").trim().slice(0, 64);
  const target = (sp.target ?? "").trim().slice(0, 64);
  const filtered = q !== "" || target !== "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // Retention follows the wallet tier, never users.plan.
  const plan = (await getEntitlements(user.id))?.tier ?? "free";
  const retentionDays = PLAN_CAPABILITIES[plan].auditRetentionDays;

  // Page header: title and one line of scope.
  const header = (
    <header>
      <h1 className="font-display text-2xl font-bold tracking-tight">Audit logs</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Security-relevant actions on your account — API keys, servers, MCPs, team, and billing
        {retentionDays > 0 ? (
          <>
            , retained <span className="tabular-nums">{retentionDays}</span> days
          </>
        ) : (
          ""
        )}
        .
      </p>
    </header>
  );

  // Unfunded accounts have 0-day retention — a first top-up unlocks the feature.
  if (retentionDays === 0) {
    return (
      <div className="space-y-6 md:space-y-8">
        {header}
        <FundedCard
          title="Audit logs need paid credit"
          description={`See who did what on your account — API-key creation, server changes, billing events — retained for ${PLAN_CAPABILITIES.pro.auditRetentionDays} days once your account is funded.`}
        />
      </div>
    );
  }

  const since = new Date(Date.now() - retentionDays * 86_400_000);
  const scope = [eq(auditLogs.userId, user.id), gte(auditLogs.createdAt, since)];
  const conditions: SQL[] = [...scope];
  if (q) conditions.push(ilike(auditLogs.action, likeContains(q)));
  if (target) conditions.push(eq(auditLogs.targetType, target));

  const [fetched, targetRows] = await Promise.all([
    // Fetch one extra row to know whether a next page exists, without a count().
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
    // The target types this account actually has, for the filter select.
    db
      .selectDistinct({ targetType: auditLogs.targetType })
      .from(auditLogs)
      .where(and(...scope))
      .orderBy(asc(auditLogs.targetType))
      .limit(50),
  ]);
  const rows = fetched.slice(0, PAGE_SIZE);
  const hasNext = fetched.length > PAGE_SIZE;
  const targetTypes = targetRows.map((r) => r.targetType);
  if (target && !targetTypes.includes(target)) targetTypes.push(target);

  return (
    <div className="space-y-6 md:space-y-8">
      {header}

      {/* Filter bar: a plain GET form, so filters live in the URL and survive paging. */}
      <form
        method="get"
        action={BASE}
        role="search"
        aria-label="Filter audit logs"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="audit-q" className="text-sm font-medium">
            Action
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="audit-q"
              name="q"
              defaultValue={q}
              maxLength={64}
              placeholder="e.g. api_key.create"
              className="pl-9 font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-52">
          <label htmlFor="audit-target" className="text-sm font-medium">
            Target
          </label>
          <select
            id="audit-target"
            name="target"
            defaultValue={target}
            className={cn(fieldClasses, "h-10 [&>option]:bg-card [&>option]:text-foreground")}
          >
            <option value="">All targets</option>
            {targetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 sm:flex-none">
            Filter
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href={BASE as Route}>Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Search}
            title="No events match these filters"
            description="Try another action or target, or clear the filters."
          />
        ) : (
          <EmptyState
            icon={ScrollText}
            title="No audit events yet"
            description="Actions like creating an API key or a server will appear here."
          />
        )
      ) : (
        // The action as a mono badge; target ids and addresses in mono too.
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="w-32">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono font-medium">
                    {r.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{r.targetType}</span>
                  {r.targetId && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {r.targetId.slice(0, 12)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.ip ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {(page > 1 || hasNext) && (
        // Pager: outline buttons either side, the page number in the middle.
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={pageHref(page - 1, q, target)}>
                <ArrowLeft aria-hidden />
                Newer
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ArrowLeft aria-hidden />
              Newer
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page <span className="font-semibold tabular-nums text-foreground">{page}</span>
          </span>
          {hasNext ? (
            <Button asChild variant="outline">
              <Link href={pageHref(page + 1, q, target)}>
                Older
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Older
              <ArrowRight aria-hidden />
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
