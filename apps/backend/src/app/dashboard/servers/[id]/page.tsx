import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { formatDateTime } from "@/lib/format";
import { AlertCircle, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers, userServers, mcpServers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { keepWarm } from "@/lib/plan-features";
import { ServerControls } from "./controls";
import { InstalledMcps } from "./installed-mcps";
import { ConnectPanel } from "./connect-panel";
import { ServerStatusBadge } from "./server-status-badge";
// Lazy: the logs viewer (and its 2s polling) only mounts when the Logs tab is
// opened — split it into its own chunk instead of the server-detail bundle.
const LogsViewer = dynamic(() => import("./logs-viewer").then((m) => m.LogsViewer));
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";

// Runtime facts are typeset as address lines: a small-caps label over its value.
const factLabel = "smallcaps tracking-sc text-xs text-muted-foreground";

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
    <div className="space-y-8">
      {/* Page header (DESIGN.md §5): a "Servers" eyebrow with its rule, the
          engraved name with the live status beside it, the slug in Courier,
          controls top-right, then the double rule. */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
              Servers
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="smallcaps tracking-sc text-2xl font-medium">{srv.name}</h1>
              <ServerStatusBadge serverId={srv.id} initialStatus={srv.status} />
            </div>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{srv.slug}</p>
          </div>
          <ServerControls serverId={srv.id} status={srv.status} />
        </div>
        <Separator variant="double" className="mt-4" />
      </div>

      {srv.status === "error" && (
        // An oxblood memo (DESIGN.md §5 callouts): tint, hairline, a rule down the left.
        <div className="flex items-start gap-2 border border-destructive/40 border-l-2 border-l-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This server&apos;s runtime failed to start. Open the{" "}
            <strong className="font-medium">Logs</strong> tab below to see why, then{" "}
            <strong className="font-medium">Restart</strong> it.
          </p>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base">Runtime</CardTitle>
              <CardDescription>
                {srv.hostType === "local_agent"
                  ? "Runs on your machine via the local agent."
                  : "Upstash Box hosting this MCP server."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Address lines: each fact on its own hairline, two to a row on wide stock. */}
              <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className={factLabel}>Box ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{srv.boxId ?? "—"}</dd>
                </div>
                <div className="border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                  <dt className={factLabel}>Endpoint</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{srv.endpointUrl ?? "—"}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Size</dt>
                  <dd className="mt-0.5 capitalize">{srv.boxSize}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Region</dt>
                  <dd className="mt-0.5 font-mono text-xs">{srv.region ?? "—"}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Last heartbeat</dt>
                  <dd className="lining mt-0.5">
                    {srv.lastHeartbeatAt ? formatDateTime(srv.lastHeartbeatAt) : "—"}
                  </dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Created</dt>
                  <dd className="lining mt-0.5">{formatDateTime(srv.createdAt)}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Mode</dt>
                  {warm ? (
                    <dd className="mt-0.5 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-warning" />
                      <span>Always-on</span>
                    </dd>
                  ) : (
                    <dd className="mt-0.5 italic text-muted-foreground">Sleeps when idle</dd>
                  )}
                </div>
              </dl>

              {/* Upsell only when the feature is live (flag on) but this plan
                  doesn't have it — never advertise warm boxes before they work. */}
              {warmEnabled && !warm && (
                <Link
                  href={"/dashboard/billing" as Route}
                  className="mt-4 flex items-center gap-2 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning transition-colors hover:border-warning"
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="smallcaps tracking-sc font-medium">Upgrade to Pro</span> for
                    always-on servers — no cold start on the first request.
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
