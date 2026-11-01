import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { teamspaceMembers, teamspaces, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TeamPanel } from "./panel";
import { getEntitlements } from "@/lib/wallet/entitlements";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

  // Same gate as POST /api/v2/team: a funded grandfathered Team account.
  const plan = (await getEntitlements(user.id))?.tier ?? "free";

  const memberships = await db
    .select({
      teamspaceId: teamspaceMembers.teamspaceId,
      role: teamspaceMembers.role,
      name: teamspaces.name,
      plan: teamspaces.plan,
    })
    .from(teamspaceMembers)
    .innerJoin(teamspaces, eq(teamspaces.id, teamspaceMembers.teamspaceId))
    .where(eq(teamspaceMembers.userId, user.id));

  let members: { userId: string; email: string; role: string; joinedAt: string }[] = [];
  let teamspaceId: string | null = null;

  if (memberships.length > 0) {
    teamspaceId = memberships[0].teamspaceId;
    const rows = await db
      .select({
        userId: teamspaceMembers.userId,
        role: teamspaceMembers.role,
        joinedAt: teamspaceMembers.joinedAt,
        email: users.email,
      })
      .from(teamspaceMembers)
      .innerJoin(users, eq(users.id, teamspaceMembers.userId))
      .where(eq(teamspaceMembers.teamspaceId, teamspaceId));
    members = rows.map((r) => ({
      userId: r.userId,
      email: r.email,
      role: r.role,
      joinedAt: r.joinedAt.toISOString(),
    }));
  }

  // Team workspaces are no longer sold. Grandfathered Team subscribers keep the
  // full page, and users who already belong to a teamspace (e.g. invited by a
  // Team subscriber) keep seeing it. Everyone else gets a neutral notice — never
  // an upgrade prompt, since there is no plan to buy that adds members.
  const unavailable = plan !== "team" && memberships.length === 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">Members and roles on your teamspace.</p>
      </header>
      {unavailable ? (
        <EmptyState
          icon={Users}
          title="Team workspaces are not available"
          description="Your servers, MCPs and API keys are managed from your own account."
        />
      ) : (
        <TeamPanel
          userId={user.id}
          teamspace={
            memberships[0]
              ? {
                  id: memberships[0].teamspaceId,
                  name: memberships[0].name,
                  plan: memberships[0].plan,
                }
              : null
          }
          members={members}
        />
      )}
    </div>
  );
}
