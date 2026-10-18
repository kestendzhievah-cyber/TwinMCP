import Link from "next/link";
import type { Route } from "next";
import { formatDate } from "@/lib/format";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SERVER_QUOTAS } from "@/lib/quota";
import { cn } from "@/lib/utils";
import { CreateServerDialog } from "./create-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ArrowRight, Boxes, Plus } from "lucide-react";
import type { ServerStatus } from "@/db/schema/platform";
import { EmptyState } from "@/components/dashboard/empty-state";

// Status tints (DESIGN.md §4.9): running green, provisioning ochre, stopped
// plain stock, error oxblood, destroyed an empty outline.
const statusVariant: Record<
  ServerStatus,
  "success" | "secondary" | "warning" | "destructive" | "outline"
> = {
  running: "success",
  provisioning: "warning",
  stopped: "secondary",
  error: "destructive",
  destroyed: "outline",
};

export default async function ServersPage() {
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
  const quota = SERVER_QUOTAS[plan];

  const rows = await db
    .select({
      id: servers.id,
      name: servers.name,
      slug: servers.slug,
      status: servers.status,
      boxSize: servers.boxSize,
      region: servers.region,
      createdAt: servers.createdAt,
    })
    .from(servers)
    .where(eq(servers.userId, user.id))
    .orderBy(desc(servers.createdAt));

  const remaining = quota === Number.POSITIVE_INFINITY ? "∞" : Math.max(0, quota - rows.length);

  return (
    <div className="space-y-8">
      {/* Page header: the engraved title, the quota as an italic line under it,
          the page action top-right, then the double rule (DESIGN.md §5). */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h1 className="smallcaps tracking-sc text-2xl font-medium">Servers</h1>
            <p className="mt-1 text-sm italic text-muted-foreground">
              <span className="lining">{rows.length}</span> active ·{" "}
              <span className="lining">{remaining}</span> remaining on{" "}
              <span className="smallcaps font-medium capitalize not-italic text-foreground">
                {plan}
              </span>{" "}
              plan
            </p>
          </div>
          <CreateServerDialog plan={plan} disabled={remaining === 0} />
        </div>
        <Separator variant="double" className="mt-4" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No servers yet"
          description="A server is an isolated runtime where your MCPs live. The first one is free."
          primaryAction={
            <CreateServerDialog
              plan={plan}
              disabled={remaining === 0}
              trigger={
                <Button size="lg" disabled={remaining === 0}>
                  <Plus className="h-4 w-4" />
                  Create your first server
                </Button>
              }
            />
          }
        />
      ) : (
        // The ledger (DESIGN.md §4.5): small-capital column heads on a firmer
        // rule, hairline rows, mono slugs and regions, lining dates.
        <div className="border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-32">Region</TableHead>
                <TableHead className="w-32">Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/servers/${s.id}` as Route}
                      className="font-medium text-foreground decoration-brand/40 underline-offset-4 transition-colors hover:text-brand hover:underline"
                    >
                      {s.name}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{s.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[s.status]}>
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 rounded-full bg-current",
                          s.status === "provisioning" && "animate-pulse"
                        )}
                      />
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{s.boxSize}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.region ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/servers/${s.id}` as Route}
                      aria-label={`Open ${s.name}`}
                      className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
