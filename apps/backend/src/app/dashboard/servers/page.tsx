import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SERVER_QUOTAS } from "@/lib/quota";
import { CreateServerDialog } from "./create-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ArrowRight, Boxes } from "lucide-react";
import type { ServerStatus } from "@/db/schema/platform";

const statusVariant: Record<ServerStatus, "success" | "secondary" | "warning" | "destructive"> = {
  running: "success",
  provisioning: "warning",
  stopped: "secondary",
  error: "destructive",
  destroyed: "secondary",
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} active · {remaining} remaining on{" "}
            <span className="capitalize font-medium text-foreground">{plan}</span> plan
          </p>
        </div>
        <CreateServerDialog disabled={remaining === 0} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <Boxes className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No servers yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first MCP server to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
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
                    <Link href={`/dashboard/servers/${s.id}` as Route} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{s.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{s.boxSize}</TableCell>
                  <TableCell className="text-muted-foreground">{s.region ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/servers/${s.id}` as Route}>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
