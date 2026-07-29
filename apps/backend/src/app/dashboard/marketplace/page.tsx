import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { McpCatalogGrid } from "./grid";
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

  const catalog = await db
    .select({
      id: mcpServers.id,
      slug: mcpServers.slug,
      name: mcpServers.name,
      description: mcpServers.description,
      runtime: mcpServers.runtime,
      version: mcpServers.version,
      isOfficial: mcpServers.isOfficial,
      configSchema: mcpServers.configSchema,
    })
    .from(mcpServers)
    .where(or(eq(mcpServers.isPublic, true), eq(mcpServers.publishedByUserId, user.id)))
    .orderBy(desc(mcpServers.isOfficial), desc(mcpServers.createdAt));

  const userServers = await db
    .select({ id: servers.id, name: servers.name, status: servers.status })
    .from(servers)
    .where(eq(servers.userId, user.id))
    .orderBy(desc(servers.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {catalog.length} MCPs available · install on your servers in one click
        </p>
      </div>

      {catalog.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Catalog is empty"
          description={
            <>
              No MCPs are available yet. Ask an admin to run{" "}
              <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">
                pnpm seed:mcps
              </code>
              , then refresh.
            </>
          }
          primaryAction={<RefreshCatalogButton />}
        />
      ) : (
        <div className="space-y-10">
          <McpBundles catalog={catalog} userServers={userServers} />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">All MCPs</h2>
            <McpCatalogGrid catalog={catalog} userServers={userServers} />
          </div>
        </div>
      )}
    </div>
  );
}
