import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { formatDateTime } from "@/lib/format";
import { Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers, userServers, mcpServers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { keepWarm } from "@/lib/plan-features";
import { ServerControls } from "./controls";
import { InstalledMcps } from "./installed-mcps";
import { ConnectPanel } from "./connect-panel";
import { ServerStatusBadge } from "./server-status-badge";
import { LogsViewer } from "./logs-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";

export default async function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // srv, the user's plan, and this server's installations are independent
  // (installations key off the id param — srv.id === id), so fetch them in
  // parallel instead of three sequential round-trips. srv is projected to the
  // columns the page renders rather than SELECT *.
  const [[srv], [me], installations] = await Promise.all([
    db
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        status: servers.status,
        hostType: servers.hostType,
        boxId: servers.boxId,
        boxSize: servers.boxSize,
        region: servers.region,
        endpointUrl: servers.endpointUrl,
        lastHeartbeatAt: servers.lastHeartbeatAt,
        createdAt: servers.createdAt,
      })
      .from(servers)
      .where(and(eq(servers.id, id), eq(servers.userId, user.id)))
      .limit(1),
    db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id)).limit(1),
    db
      .select({
        id: userServers.id,
        enabled: userServers.enabled,
        installedAt: userServers.installedAt,
        mcpId: mcpServers.id,
        mcpSlug: mcpServers.slug,
        mcpName: mcpServers.name,
        mcpDescription: mcpServers.description,
        mcpRuntime: mcpServers.runtime,
        mcpIsOfficial: mcpServers.isOfficial,
        mcpConfigSchema: mcpServers.configSchema,
      })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(eq(userServers.serverId, id)),
  ]);
  if (!srv) notFound();

  // Runtime mode: warm (always-on, no cold start) vs pause-when-idle. Gated by
  // plan + the WARM_BOXES_ENABLED ops switch — same decision as provisioning.
  const plan = me?.plan ?? "free";
  const warmEnabled = process.env.WARM_BOXES_ENABLED === "true";
  const warm = keepWarm(plan, warmEnabled);

  function hasConfigFields(schema: unknown): boolean {
    if (!schema || typeof schema !== "object" || !("properties" in schema)) return false;
    const props = (schema as { properties?: Record<string, unknown> }).properties ?? {};
    return Object.keys(props).length > 0;
  }

  const installedOptions = installations.map((i) => ({ slug: i.mcpSlug, name: i.mcpName }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{srv.name}</h1>
            <ServerStatusBadge serverId={srv.id} initialStatus={srv.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{srv.slug}</p>
        </div>
        <ServerControls serverId={srv.id} status={srv.status} />
      </div>

      {srv.status === "error" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This server&apos;s runtime failed to start. Open the <strong>Logs</strong> tab below to
          see why, then <strong>Restart</strong> it.
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Runtime</CardTitle>
              <CardDescription>
                {srv.hostType === "local_agent"
                  ? "Runs on your machine via the local agent."
                  : "Upstash Box hosting this MCP server."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Box ID
                </div>
                <div className="font-mono text-xs break-all">{srv.boxId ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Endpoint
                </div>
                <div className="font-mono text-xs break-all">{srv.endpointUrl ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Size
                </div>
                <div className="capitalize">{srv.boxSize}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Region
                </div>
                <div>{srv.region ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Last heartbeat
                </div>
                <div>{srv.lastHeartbeatAt ? formatDateTime(srv.lastHeartbeatAt) : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Created
                </div>
                <div>{formatDateTime(srv.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Mode
                </div>
                {warm ? (
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Always-on</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">Sleeps when idle</div>
                )}
              </div>

              {/* Upsell only when the feature is live (flag on) but this plan
                  doesn't have it — never advertise warm boxes before they work. */}
              {warmEnabled && !warm && (
                <Link
                  href={"/dashboard/billing" as Route}
                  className="md:col-span-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-medium">Upgrade to Pro</span> for always-on servers — no
                    cold start on the first request.
                  </span>
                </Link>
              )}
            </CardContent>
          </Card>

          <ConnectPanel
            serverSlug={srv.slug}
            hostType={srv.hostType}
            status={srv.status}
            mcps={installations.map((i) => ({
              slug: i.mcpSlug,
              name: i.mcpName,
              enabled: i.enabled,
            }))}
          />

          <InstalledMcps
            serverId={srv.id}
            serverSlug={srv.slug}
            twinmcpDocsSlug={TWINMCP_DOCS_SLUG}
            items={installations.map((i) => ({
              id: i.id,
              enabled: i.enabled,
              installedAt: i.installedAt.toISOString(),
              mcpId: i.mcpId,
              mcpSlug: i.mcpSlug,
              mcpName: i.mcpName,
              mcpDescription: i.mcpDescription,
              mcpRuntime: i.mcpRuntime ?? "node",
              mcpIsOfficial: i.mcpIsOfficial,
              hasConfig: hasConfigFields(i.mcpConfigSchema),
            }))}
          />
        </TabsContent>

        <TabsContent value="logs">
          <LogsViewer serverId={srv.id} installed={installedOptions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
