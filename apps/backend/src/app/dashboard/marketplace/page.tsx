import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers, users, userServers as installedTable } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { McpCatalogGrid, type InstalledMap, type MarketplaceEntry } from "./grid";
import { configNeedsKey, configNeedsSetup } from "@/lib/mcp/bundles";
import { McpBundles } from "./bundles";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Separator } from "@/components/ui/separator";
import { RefreshCatalogButton } from "./refresh-button";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

  const catalogWhere = or(eq(mcpServers.isPublic, true), eq(mcpServers.publishedByUserId, user.id));
  const baseCols = {
    id: mcpServers.id,
    slug: mcpServers.slug,
    name: mcpServers.name,
    description: mcpServers.description,
    runtime: mcpServers.runtime,
    version: mcpServers.version,
    isOfficial: mcpServers.isOfficial,
    hostMode: mcpServers.hostMode,
    repoUrl: mcpServers.repoUrl,
    createdAt: mcpServers.createdAt,
    configSchema: mcpServers.configSchema,
  };

  // The config schema is read server-side only to flag each entry (does it
  // need a key? any setup at all?) and is not shipped to the client: the
  // install dialog fetches the schema of the MCP being installed on demand.
  const toEntry = <R extends { createdAt: Date; configSchema: unknown }>(row: R) => {
    const { configSchema, createdAt, ...rest } = row;
    return {
      ...rest,
      createdAt: createdAt.getTime(),
      needsKey: configNeedsKey(configSchema),
      needsConfig: configNeedsSetup(configSchema),
    };
  };

  // `category` ships in migration 0009. When the app image is deployed before
  // migrations run (deploy → migrate ordering), the column can be briefly
  // absent — degrade to a category-less catalog instead of 500-ing the page.
  // Capped at 200 so the render/transfer stays bounded as the catalog grows.
  const loadCatalog = async (): Promise<MarketplaceEntry[]> => {
    try {
      const rows = await db
        .select({ ...baseCols, category: mcpServers.category })
        .from(mcpServers)
        .where(catalogWhere)
        .orderBy(desc(mcpServers.isOfficial), desc(mcpServers.createdAt))
        .limit(200);
      return rows.map(toEntry);
    } catch (err) {
      console.error("[marketplace] catalog query with category failed; falling back", err);
      const rows = await db
        .select(baseCols)
        .from(mcpServers)
        .where(catalogWhere)
        .orderBy(desc(mcpServers.isOfficial), desc(mcpServers.createdAt))
        .limit(200);
      return rows.map((c) => ({ ...toEntry(c), category: null }));
    }
  };

  // Catalog, the user's servers, their installs and the plan are independent —
  // run in parallel instead of four sequential round-trips. The plan decides
  // whether a full small box shows the Pro toast (Free) or the server's own
  // "use a larger box" message (paid plans).
  const [catalog, userServers, installedRows, [me]] = await Promise.all([
    loadCatalog(),
    db
      .select({
        id: servers.id,
        name: servers.name,
        status: servers.status,
        hostType: servers.hostType,
      })
      .from(servers)
      .where(eq(servers.userId, user.id))
      .orderBy(desc(servers.createdAt)),
    db
      .select({
        mcpServerId: installedTable.mcpServerId,
        serverId: servers.id,
        serverName: servers.name,
      })
      .from(installedTable)
      .innerJoin(servers, eq(servers.id, installedTable.serverId))
      .where(eq(servers.userId, user.id)),
    db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id)).limit(1),
  ]);
  const plan = me?.plan ?? "free";

  const installed: InstalledMap = {};
  for (const row of installedRows) {
    (installed[row.mcpServerId] ??= []).push({
      serverId: row.serverId,
      serverName: row.serverName,
    });
  }

  return (
    <div className="space-y-8">
      {/* Page header: engraved title, italic subtitle, double rule (DESIGN.md §5). */}
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Marketplace</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          <span className="lining">{catalog.length}</span> MCPs available · search, filter, and
          install on any of your servers
        </p>
        <Separator variant="double" className="mt-4" />
      </div>

      {catalog.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Catalog is empty"
          description="No MCPs are available yet — check back soon."
          primaryAction={<RefreshCatalogButton />}
        />
      ) : (
        <div className="space-y-12">
          <McpBundles catalog={catalog} userServers={userServers} plan={plan} />
          <div className="space-y-4">
            <h2 className="smallcaps tracking-sc flex items-center gap-4 text-xl font-medium after:h-px after:flex-1 after:bg-border after:content-['']">
              All MCPs
            </h2>
            <McpCatalogGrid
              catalog={catalog}
              userServers={userServers}
              installed={installed}
              plan={plan}
            />
          </div>
        </div>
      )}
    </div>
  );
}
