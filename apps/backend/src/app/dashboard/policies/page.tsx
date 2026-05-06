import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { teamspaceFilters, teamspaceMembers, teamspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PoliciesForm } from "./form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground text-center">
            You are not a member of any teamspace. Create one in the{" "}
            <strong className="text-foreground">Team</strong> tab to configure library filters.
          </CardContent>
        </Card>
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Teamspace: <strong className="text-foreground">{ts?.name ?? tsId}</strong>
        </p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Library filters</CardTitle>
          <CardDescription>
            Restrict which libraries members of this teamspace can access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PoliciesForm
            teamspaceId={tsId}
            minTrustScore={filters?.minTrustScore ?? 0}
            blockedLibraryIds={filters?.blockedLibraryIds ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
