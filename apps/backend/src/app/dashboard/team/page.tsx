import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { teamspaceMembers, teamspaces, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { meetsPlan } from "@/lib/plan-features";
import { UpgradeCard } from "@/components/billing/upgrade-card";
import { TeamPanel } from "./panel";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

  const [meRow] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const plan = meRow?.plan ?? "free";

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

  // Team collaboration is a Team-plan feature. Users who already belong to a
  // teamspace (e.g. granted earlier) keep access even if their plan changed.
  const locked = !meetsPlan(plan, "team") && memberships.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
      </div>
      {locked ? (
        <UpgradeCard
          title="Team collaboration"
          description="Invite teammates and share servers, policies and context across your squad."
          requiredPlan="team"
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
