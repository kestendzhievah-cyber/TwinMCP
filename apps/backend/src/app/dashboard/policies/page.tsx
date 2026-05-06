import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { teamspaceFilters, teamspaceMembers, teamspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { type Route } from "next";
import { Shield } from "lucide-react";
import { PoliciesForm } from "./form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";

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
        <EmptyState
          icon={Shield}
          title="No teamspace yet"
          description="Policies apply per-teamspace — library filters, trust thresholds, member access. Create or join a teamspace to start configuring them."
          primaryAction={
            <Button asChild>
              <Link href={"/dashboard/team" as Route}>Go to Team</Link>
            </Button>
          }
        />
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
