import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema/core";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { Separator } from "@/components/ui/separator";
import { getDailyLimit } from "@/lib/rate-limit";
import { lifecycleState } from "@/lib/server-lifecycle";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { ServerNav } from "../activity/server-nav";
import { ToolPlayground } from "./playground";

export const dynamic = "force-dynamic";

export const metadata = { title: "Playground · TwinMCP" };

const PLAN_NAMES = { free: "Free", pro: "Pro", team: "Team" } as const;

export default async function TryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?returnTo=/dashboard/servers/${encodeURIComponent(id)}/try`);

  const db = getDb();
  const [[srv], [me], installations] = await Promise.all([
    db
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        status: servers.status,
        hostType: servers.hostType,
        boxId: servers.boxId,
      })
      .from(servers)
      .where(and(eq(servers.id, id), eq(servers.userId, user.id)))
      .limit(1),
    db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id)).limit(1),
    db
      .select({
        enabled: userServers.enabled,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
      })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(and(eq(userServers.serverId, id), eq(userServers.userId, user.id))),
  ]);
  if (!srv) notFound();

  const plan = me?.plan ?? "free";
  // TwinMCP Docs is served by the control plane with an API key, not by the
  // box: it is tried from an IDE, not here. Disabled MCPs cannot be called.
  const runnable = installations
    .filter((i) => i.enabled && i.slug !== TWINMCP_DOCS_SLUG)
    .map((i) => ({ slug: i.slug, name: i.name, description: i.description ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const disabledCount = installations.filter(
    (i) => !i.enabled && i.slug !== TWINMCP_DOCS_SLUG
  ).length;

  return (
    <div className="space-y-8">
      {/* Page header (DESIGN.md §5), same as the server overview and activity. */}
      <div>
        <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          Servers
        </p>
        <h1 className="smallcaps tracking-sc mt-2 text-2xl font-medium">{srv.name}</h1>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{srv.slug}</p>
        <Separator variant="double" className="mt-4" />
        <div className="mt-4">
          <ServerNav serverId={srv.id} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="smallcaps tracking-sc text-lg font-medium">Playground</h2>
        <p className="max-w-2xl text-sm italic text-muted-foreground">
          List the tools of an MCP on this server and run one with a generated form. Calls run for
          real, with the configuration you saved, and go through the same quota and tool policy as
          your IDE.
        </p>
      </div>

      <ToolPlayground
        serverId={srv.id}
        serverSlug={srv.slug}
        mcps={runnable}
        disabledCount={disabledCount}
        lifecycle={lifecycleState(srv)}
        dailyLimit={getDailyLimit(plan)}
        planName={PLAN_NAMES[plan]}
      />
    </div>
  );
}
