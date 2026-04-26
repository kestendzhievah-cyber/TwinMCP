import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { teamspaceMembers, teamspaces, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TeamPanel } from "./panel";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

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

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Team</h1>
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
    </div>
  );
}
