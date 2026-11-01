import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { formatDateTime } from "@/lib/format";
import { AlertTriangle, PauseCircle, ServerOff, Zap } from "lucide-react";
import { lifecycleState } from "@/lib/server-lifecycle";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers, userServers, mcpServers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { keepWarm } from "@/lib/plan-features";
import { getEntitlements } from "@/lib/wallet/entitlements";
import { ServerControls } from "./controls";
import { InstalledMcps } from "./installed-mcps";
import { ConnectPanel } from "./connect-panel";
import { ServerStatusBadge } from "./server-status-badge";
import { ServerHeader } from "./server-header";
// Lazy: the logs viewer (and its 2s polling) only mounts when the Logs tab is
// opened — split it into its own chunk instead of the server-detail bundle.
const LogsViewer = dynamic(() => import("./logs-viewer").then((m) => m.LogsViewer));
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { IDE_LABELS, type IdeKey } from "@/lib/mcp/client-config";

// Runtime facts: a small muted label over its value.
const factLabel = "text-xs font-medium text-muted-foreground";
// A status callout: a rounded tinted strip with a leading icon.
const callout = "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm";

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
  const [[srv], [me], installations, ent] = await Promise.all([
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
    db.select({ metadata: users.metadata }).from(users).where(eq(users.id, user.id)).limit(1),
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
    getEntitlements(user.id),
  ]);
  if (!srv) notFound();
  const lifecycle = lifecycleState(srv);

  // Runtime mode: warm (always-on, no cold start) vs pause-when-idle. Gated by
  // plan + the WARM_BOXES_ENABLED ops switch — same decision as provisioning
  // (the wallet tier from getEntitlements, never users.plan).
  const plan = ent?.tier ?? "free";
  const warmEnabled = process.env.WARM_BOXES_ENABLED === "true";
  const warm = keepWarm(plan, warmEnabled);

  function hasConfigFields(schema: unknown): boolean {
    if (!schema || typeof schema !== "object" || !("properties" in schema)) return false;
    const props = (schema as { properties?: Record<string, unknown> }).properties ?? {};
    return Object.keys(props).length > 0;
  }

  // The IDE picked during onboarding preselects the Connect panel's client.
  const idePref = (me?.metadata as Record<string, unknown> | undefined)?.ide_preference;
  const initialIde =
    typeof idePref === "string" && Object.prototype.hasOwnProperty.call(IDE_LABELS, idePref)
      ? (idePref as IdeKey)
      : null;

  const installedOptions = installations.map((i) => ({ slug: i.mcpSlug, name: i.mcpName }));

  return (
    <div className="space-y-6 md:space-y-8">
      <ServerHeader
        serverId={srv.id}
        name={srv.name}
        slug={srv.slug}
        status={
          <ServerStatusBadge
            serverId={srv.id}
            initialStatus={srv.status}
            hostType={srv.hostType}
            initialBoxId={srv.boxId}
          />
        }
        actions={
          <ServerControls
            serverId={srv.id}
            serverName={srv.name}
            status={srv.status}
            hostType={srv.hostType}
            boxId={srv.boxId}
          />
        }
      />

      {/* `stopped` reads two ways (lib/server-lifecycle.ts): paused with its
          box kept, or no runtime at all. Say which, in plain words. */}
      {lifecycle === "paused" && (
        <div className={cn(callout, "border-info/30 bg-info/10 text-info")}>
          <PauseCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong className="font-semibold">Paused.</strong> The box and its data are kept. The
            next MCP request wakes it after a short delay, or press{" "}
            <strong className="font-semibold">Resume</strong>.
          </p>
        </div>
      )}
      {lifecycle === "no_runtime" && (
        <div className={cn(callout, "border-border bg-secondary text-muted-foreground")}>
          <ServerOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong className="font-semibold text-foreground">No runtime.</strong> Your MCPs and
            their configuration are saved.{" "}
            <strong className="font-semibold text-foreground">Start</strong> creates a fresh box and
            installs them.
          </p>
        </div>
      )}

      {srv.status === "error" && (
        <div className={cn(callout, "border-destructive/30 bg-destructive/10 text-destructive")}>
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This server&apos;s runtime failed to start. Open the{" "}
            <strong className="font-semibold">Logs</strong> tab below to see why, then{" "}
            <strong className="font-semibold">Restart</strong> it.
          </p>
        </div>
      )}

      {/* Sub-sections of the overview. Segmented, so they read one level below
          the underline section nav above. */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Setup</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Connect first: it is the next step for a new server. */}
          <ConnectPanel
            serverSlug={srv.slug}
            serverName={srv.name}
            initialIde={initialIde}
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

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle as="h2">Runtime</CardTitle>
              <CardDescription>
                {srv.hostType === "local_agent"
                  ? "Runs on your machine via the local agent."
                  : "Upstash Box hosting this MCP server."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 sm:pt-6">
              <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className={factLabel}>Box ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{srv.boxId ?? "—"}</dd>
                </div>
                <div className="border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                  <dt className={factLabel}>Endpoint</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{srv.endpointUrl ?? "—"}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Size</dt>
                  <dd className="mt-1 capitalize">{srv.boxSize}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Region</dt>
                  <dd className="mt-1 font-mono text-xs">{srv.region ?? "—"}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Last heartbeat</dt>
                  <dd className="mt-1 tabular-nums">
                    {srv.lastHeartbeatAt ? formatDateTime(srv.lastHeartbeatAt) : "—"}
                  </dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Created</dt>
                  <dd className="mt-1 tabular-nums">{formatDateTime(srv.createdAt)}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <dt className={factLabel}>Mode</dt>
                  {warm ? (
                    <dd className="mt-1 flex items-center gap-1.5">
                      <Zap aria-hidden className="h-4 w-4 text-warning" />
                      <span>Always-on</span>
                    </dd>
                  ) : (
                    <dd className="mt-1 text-muted-foreground">Sleeps when idle</dd>
                  )}
                </div>
              </dl>

              {/* Upsell only when the feature is live (flag on) but this plan
                  does not have it: never advertise warm boxes before they work. */}
              {warmEnabled && !warm && (
                <Link
                  href={"/dashboard/billing" as Route}
                  className="mt-5 flex items-center gap-2 rounded-xl border border-offer-border bg-offer px-4 py-3 text-sm text-offer-foreground transition hover:shadow-md"
                >
                  <Zap aria-hidden className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-semibold">Add credit</span> for always-on servers — no
                    cold start on the first request.
                  </span>
                </Link>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <LogsViewer serverId={srv.id} installed={installedOptions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
