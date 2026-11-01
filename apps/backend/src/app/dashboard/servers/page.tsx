import Link from "next/link";
import type { Route } from "next";
import { formatDate } from "@/lib/format";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SERVER_QUOTAS } from "@/lib/quota";
import { PLAN_CAPABILITIES, PLAN_LABELS } from "@/lib/plan-features";
import { getEntitlements } from "@/lib/wallet/entitlements";
import { CreateServerDialog } from "./create-dialog";
import { TopUpInline } from "@/components/billing/top-up-inline";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ArrowRight, Boxes, Plus } from "lucide-react";
import { lifecycleLabel } from "@/lib/server-lifecycle-label";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LifecycleBadge } from "./lifecycle-badge";

export default async function ServersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // The tier comes from the wallet (getEntitlements), never users.plan, so
  // the quota, label and dialog options match what POST /api/v2/servers allows.
  const plan = (await getEntitlements(user.id))?.tier ?? "free";
  const quota = SERVER_QUOTAS[plan];

  const rows = await db
    .select({
      id: servers.id,
      name: servers.name,
      slug: servers.slug,
      status: servers.status,
      hostType: servers.hostType,
      boxId: servers.boxId,
      boxSize: servers.boxSize,
      region: servers.region,
      createdAt: servers.createdAt,
    })
    .from(servers)
    .where(eq(servers.userId, user.id))
    .orderBy(desc(servers.createdAt));

  // Destroyed servers stay in the ledger but never count against the quota
  // (lib/quota.ts assertServerQuota counts the same way).
  const active = rows.filter((s) => s.status !== "destroyed").length;
  const remaining = quota === Number.POSITIVE_INFINITY ? "∞" : Math.max(0, quota - active);
  const atFreeLimit = plan === "free" && remaining === 0;
  const pro = PLAN_CAPABILITIES.pro;
  const proBoxes = `${pro.boxSizes.slice(0, -1).join(", ")} or ${pro.boxSizes[pro.boxSizes.length - 1]}`;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header row: title, a one-line description, the page's single primary
          action on the right (hidden while the empty state carries it). */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight">Servers</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{active}</span> active ·{" "}
              <span className="tabular-nums">{remaining}</span> remaining ·{" "}
              <span className="font-medium text-foreground">{PLAN_LABELS[plan]}</span>
            </p>
          </div>
          {rows.length > 0 && <CreateServerDialog plan={plan} disabled={remaining === 0} />}
        </div>
        {atFreeLimit && (
          <TopUpInline
            source="servers"
            level="offer"
            reason="servers_limit"
            description={`Free credit accounts run ${PLAN_CAPABILITIES.free.servers} server. After a first top-up you can run up to ${pro.servers} servers on ${proBoxes} boxes.`}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No servers yet"
          description="A server is an isolated runtime where your MCPs live. It runs on your TwinMCP credit."
          primaryAction={
            <CreateServerDialog
              plan={plan}
              disabled={remaining === 0}
              trigger={
                <Button size="lg" disabled={remaining === 0} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Create server
                </Button>
              }
            />
          }
        />
      ) : (
        <>
          {/* Phones: one card per server. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((s) => {
              const view = lifecycleLabel(s);
              return (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/servers/${s.id}` as Route}
                    className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{s.name}</p>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {s.slug}
                        </p>
                      </div>
                      <ArrowRight
                        aria-hidden
                        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                      <LifecycleBadge view={view} className="whitespace-normal" />
                      <span className="capitalize">{s.boxSize}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{formatDate(s.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* From md: the table. */}
          <Table containerClassName="hidden shadow-sm md:block">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-48">Status</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-32">Region</TableHead>
                <TableHead className="w-32">Created</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                // `stopped` reads two ways: paused (box kept) or no runtime
                // (lib/server-lifecycle-label.ts).
                const view = lifecycleLabel(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/servers/${s.id}` as Route}
                        className="font-semibold text-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                      >
                        {s.name}
                      </Link>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{s.slug}</div>
                    </TableCell>
                    <TableCell>
                      <LifecycleBadge view={view} />
                    </TableCell>
                    <TableCell className="capitalize">{s.boxSize}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.region ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/servers/${s.id}` as Route}
                        aria-label={`Open ${s.name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
