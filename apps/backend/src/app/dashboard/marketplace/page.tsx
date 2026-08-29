import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers, userServers as installedTable } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { McpCatalogGrid, type InstalledMap } from "./grid";
import type { CatalogEntry } from "./install-dialog";
import { McpBundles } from "./bundles";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
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
  };

  // `category` ships in migration 0009. When the app image is deployed before
  // migrations run (deploy → migrate ordering), the column can be briefly
  // absent — degrade to a category-less catalog instead of 500-ing the page.
  // Self-heals once the migration lands.
  let catalog: CatalogEntry[];
  try {
    const rows = await db
      .select({ ...baseCols, category: mcpServers.category })
      .from(mcpServers)
      .where(catalogWhere)
      .orderBy(desc(mcpServers.isOfficial), desc(mcpServers.createdAt));
    catalog = rows.map((c) => ({ ...c, createdAt: c.createdAt.getTime() }));
  } catch (err) {
    console.error("[marketplace] catalog query with category failed; falling back", err);
    const rows = await db
      .select(baseCols)
      .from(mcpServers)
      .where(catalogWhere)
      .orderBy(desc(mcpServers.isOfficial), desc(mcpServers.createdAt));
    catalog = rows.map((c) => ({ ...c, createdAt: c.createdAt.getTime(), category: null }));
  }

  const userServers = await db
    .select({
      id: servers.id,
      name: servers.name,
      status: servers.status,
      hostType: servers.hostType,
    })
    .from(servers)
    .where(eq(servers.userId, user.id))
    .orderBy(desc(servers.createdAt));

  // Which catalog MCPs the user already installed, and on which server(s), so
  // the grid can show an "Installed" state that links to the server.
  const installedRows = await db
    .select({
      mcpServerId: installedTable.mcpServerId,
      serverId: servers.id,
      serverName: servers.name,
    })
    .from(installedTable)
    .innerJoin(servers, eq(servers.id, installedTable.serverId))
    .where(eq(servers.userId, user.id));

  const installed: InstalledMap = {};
  for (const row of installedRows) {
    (installed[row.mcpServerId] ??= []).push({
      serverId: row.serverId,
      serverName: row.serverName,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {catalog.length} MCPs available · search, filter, and install on any of your servers
        </p>
      </div>

      {catalog.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Catalog is empty"
          description="No MCPs are available yet — check back soon."
          primaryAction={<RefreshCatalogButton />}
        />
      ) : (
        <div className="space-y-10">
          <McpBundles catalog={catalog} userServers={userServers} />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">All MCPs</h2>
            <McpCatalogGrid catalog={catalog} userServers={userServers} installed={installed} />
          </div>
        </div>
      )}
    </div>
  );
}
