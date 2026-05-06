import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ServerControls } from "./controls";
import { InstalledMcps } from "./installed-mcps";
import { LogsViewer } from "./logs-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import type { ServerStatus } from "@/db/schema/platform";

const statusVariant: Record<ServerStatus, "success" | "secondary" | "warning" | "destructive"> = {
  running: "success",
  provisioning: "warning",
  stopped: "secondary",
  error: "destructive",
  destroyed: "secondary",
};

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [srv] = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, id), eq(servers.userId, user.id)))
    .limit(1);
  if (!srv) notFound();

  const installations = await db
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
    .where(eq(userServers.serverId, srv.id));

  function hasConfigFields(schema: unknown): boolean {
    if (!schema || typeof schema !== "object" || !("properties" in schema)) return false;
    const props = (schema as { properties?: Record<string, unknown> }).properties ?? {};
    return Object.keys(props).length > 0;
  }

  const installedOptions = installations.map((i) => ({ slug: i.mcpSlug, name: i.mcpName }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{srv.name}</h1>
            <Badge variant={statusVariant[srv.status]}>{srv.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{srv.slug}</p>
        </div>
        <ServerControls serverId={srv.id} status={srv.status} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Runtime</CardTitle>
              <CardDescription>Upstash Box hosting this MCP server.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Box ID
                </div>
                <div className="font-mono text-xs">{srv.boxId ?? "—"}</div>
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
                <div>{srv.lastHeartbeatAt?.toLocaleString() ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                  Created
                </div>
                <div>{srv.createdAt.toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

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
