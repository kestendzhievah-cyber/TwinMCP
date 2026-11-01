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
import { getEntitlements } from "@/lib/wallet/entitlements";

export default async function PoliciesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

  const [memberships, ent] = await Promise.all([
    db
      .select({ teamspaceId: teamspaceMembers.teamspaceId, role: teamspaceMembers.role })
      .from(teamspaceMembers)
      .where(eq(teamspaceMembers.userId, user.id)),
    getEntitlements(user.id),
  ]);

  if (memberships.length === 0) {
    // Team workspaces are no longer sold: only grandfathered Team subscribers are
    // pointed at the Team page to create one. Everyone else gets a neutral notice.
    // Same gate as POST /api/v2/team: a funded grandfathered Team account.
    if ((ent?.tier ?? "free") !== "team") {
      return (
        <div className="space-y-6 md:space-y-8">
          <header>
            <h1 className="font-display text-2xl font-bold tracking-tight">Policies</h1>
          </header>
          <EmptyState
            icon={Shield}
            title="Policies are not available"
            description="Policies apply to team workspaces, which are not available."
          />
        </div>
      );
    }
    return (
      <div className="space-y-6 md:space-y-8">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight">Policies</h1>
        </header>
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
    <div className="space-y-6 md:space-y-8">
      {/* Page header: title, and the teamspace as the one-line description. */}
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Policies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teamspace: <strong className="font-semibold text-foreground">{ts?.name ?? tsId}</strong>
        </p>
      </header>
      <Card className="max-w-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle>Library filters</CardTitle>
          <CardDescription>
            Restrict which libraries members of this teamspace can access.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-[var(--card-padding)]">
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
