import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { teamspaceFilters, teamspaceMembers, teamspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PoliciesForm } from "./form";

export default async function PoliciesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

  const memberships = await db
    .select({ teamspaceId: teamspaceMembers.teamspaceId, role: teamspaceMembers.role })
    .from(teamspaceMembers)
    .where(eq(teamspaceMembers.userId, user.id));

  if (memberships.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Policies</h1>
        <p style={{ color: "#666", fontSize: "0.875rem" }}>
          You are not a member of any teamspace. Create a team first in the Team tab to configure
          library filters.
        </p>
      </div>
    );
  }

  const tsId = memberships[0].teamspaceId;
  const [ts] = await db.select().from(teamspaces).where(eq(teamspaces.id, tsId)).limit(1);
  const [filters] = await db
    .select()
    .from(teamspaceFilters)
    .where(eq(teamspaceFilters.teamspaceId, tsId))
    .limit(1);

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Policies</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        Teamspace: <strong>{ts?.name ?? tsId}</strong>
      </p>
      <PoliciesForm
        teamspaceId={tsId}
        minTrustScore={filters?.minTrustScore ?? 0}
        blockedLibraryIds={filters?.blockedLibraryIds ?? []}
      />
    </div>
  );
}
