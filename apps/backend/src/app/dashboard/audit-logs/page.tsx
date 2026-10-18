import Link from "next/link";
import type { Route } from "next";
import { and, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, ArrowRight, ScrollText } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { UpgradeCard } from "@/components/billing/upgrade-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, parseInt((await searchParams).page ?? "1", 10) || 1);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [me] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const plan = me?.plan ?? "free";
  const retentionDays = PLAN_CAPABILITIES[plan].auditRetentionDays;

  // Page header (DESIGN.md §5): engraved title, italic scope line, double rule.
  const header = (
    <div>
      <h1 className="smallcaps tracking-sc text-2xl font-medium">Audit logs</h1>
      <p className="mt-1 text-sm italic text-muted-foreground">
        Security-relevant actions on your account — API keys, servers, MCPs, team, and billing
        {retentionDays > 0 ? (
          <>
            , retained <span className="lining">{retentionDays}</span> days
          </>
        ) : (
          ""
        )}
        .
      </p>
      <Separator variant="double" className="mt-4" />
    </div>
  );

  // Free plan has 0-day retention — the feature is Pro+.
  if (retentionDays === 0) {
    return (
      <div className="space-y-8">
        {header}
        <UpgradeCard
          title="Audit logs are a paid feature"
          description="See who did what on your account — API-key creation, server changes, billing events — retained for 30 (Pro) or 90 (Team) days."
          requiredPlan="pro"
        />
      </div>
    );
  }

  const since = new Date(Date.now() - retentionDays * 86_400_000);
  // Fetch one extra row to know whether a next page exists, without a count().
  const fetched = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.userId, user.id), gte(auditLogs.createdAt, since)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  const rows = fetched.slice(0, PAGE_SIZE);
  const hasNext = fetched.length > PAGE_SIZE;

  return (
    <div className="space-y-8">
      {header}

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events yet"
          description="Actions like creating an API key or a server will appear here."
        />
      ) : (
        // The ledger (DESIGN.md §4.5): lining timestamps, the action as a mono
        // stamp, target ids and addresses in Courier.
        <div className="border border-border bg-card shadow-sm">
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
                    <Badge variant="secondary" className="no-smallcaps font-mono">
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
        </div>
      )}

      {(page > 1 || hasNext) && (
        // Pager: hairline above, small-caps folio in the middle, square buttons either side.
        <div className="flex items-center justify-between border-t border-border pt-4">
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/audit-logs?page=${page - 1}` as Route}>
                <ArrowLeft className="h-4 w-4" />
                Newer
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ArrowLeft className="h-4 w-4" />
              Newer
            </Button>
          )}
          <span className="smallcaps tracking-sc text-xs text-muted-foreground">
            Page <span className="lining">{page}</span>
          </span>
          {hasNext ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/audit-logs?page=${page + 1}` as Route}>
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
