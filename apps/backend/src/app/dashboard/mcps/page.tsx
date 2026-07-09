import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, users } from "@/db/schema";
import { can, minPlanFor } from "@/lib/plan-features";
import { UpgradeCard } from "@/components/billing/upgrade-card";
import { PublishMcpPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function McpsPage() {
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
  const canPublish = can(plan, "publishMcp");

  const mine = await db
    .select({
      id: mcpServers.id,
      slug: mcpServers.slug,
      name: mcpServers.name,
      runtime: mcpServers.runtime,
      version: mcpServers.version,
      isPublic: mcpServers.isPublic,
      description: mcpServers.description,
      createdAt: mcpServers.createdAt,
    })
    .from(mcpServers)
    .where(and(eq(mcpServers.publishedByUserId, user.id), eq(mcpServers.isOfficial, false)))
    .orderBy(desc(mcpServers.createdAt));

  const mcps = mine.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Publish an MCP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Package any stdio MCP server so you can install it on your boxes — and optionally list it
          in the marketplace for everyone.
        </p>
      </div>

      {!canPublish && mcps.length === 0 ? (
        <UpgradeCard
          title="Publishing MCPs is a paid feature"
          description="Package your own MCP servers, install them on your boxes, and share them in the marketplace."
          requiredPlan={minPlanFor("publishMcp")}
        />
      ) : (
        <PublishMcpPanel mcps={mcps} canPublish={canPublish} />
      )}
    </div>
  );
}
