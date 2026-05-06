import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { McpCatalogGrid } from "./grid";
import { Card, CardContent } from "@/components/ui/card";
import { Store } from "lucide-react";

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
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <Store className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Catalog is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">pnpm seed:mcps</code> to load official MCPs.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <McpCatalogGrid catalog={catalog} userServers={userServers} />
      )}
    </div>
  );
}
