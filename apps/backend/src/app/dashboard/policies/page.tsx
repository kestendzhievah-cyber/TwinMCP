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
import { Separator } from "@/components/ui/separator";
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
      <div className="space-y-8">
        <div>
          <h1 className="smallcaps tracking-sc text-2xl font-medium">Policies</h1>
          <Separator variant="double" className="mt-4" />
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
      {/* Page header (DESIGN.md §5): engraved title, the teamspace as an italic line, double rule. */}
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Policies</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Teamspace:{" "}
          <strong className="font-medium not-italic text-foreground">{ts?.name ?? tsId}</strong>
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      <Card className="max-w-xl">
        <CardHeader className="border-b border-border">
          <CardTitle>Library filters</CardTitle>
          <CardDescription>
            Restrict which libraries members of this teamspace can access.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
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
