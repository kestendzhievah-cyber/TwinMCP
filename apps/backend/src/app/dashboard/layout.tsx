import { redirect } from "next/navigation";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { prospects, servers, teamspaceMembers, users } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { attentionCount } from "@/lib/admin/attention";
import { computeUpgradeNudge } from "@/lib/billing/upgrade-state";
import { loadUpgradeSignals } from "@/lib/billing/upgrade-signals";
import { UpgradeBanner, type SerializedNudge } from "@/components/billing/upgrade-banner";
import { needsOnboarding } from "@/lib/auth/return-to";
import { DashboardNav } from "./nav";
import { OnboardingGate } from "./onboarding-gate";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard");

  const db = getDb();
  const isAdmin = isAdminEmail(user.email);

  // The upgrade signals (lib/billing/upgrade-signals.ts) are loaded once per
  // request and shared with the overview page through React cache. The Team
  // link follows app/dashboard/team/page.tsx: grandfathered Team subscribers
  // plus anyone already in a teamspace (guarded — a nav link must never 500).
  const [signals, [teamRow], gate] = await Promise.all([
    loadUpgradeSignals(user.id),
    db
      .select({ n: count() })
      .from(teamspaceMembers)
      .where(eq(teamspaceMembers.userId, user.id))
      .catch((err: unknown) => {
        console.warn("[dashboard] teamspace membership unavailable:", err);
        return [] as { n: number }[];
      }),
    // Onboarding gate inputs (admins never gated). Guarded: unknown = no redirect.
    isAdmin
      ? Promise.resolve(null)
      : Promise.all([
          db
            .select({ completedAt: users.onboardingCompletedAt })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1),
          db
            .select({ n: count() })
            .from(servers)
            .where(and(eq(servers.userId, user.id), ne(servers.status, "destroyed"))),
        ])
          .then(([[me], [srv]]) => ({
            onboardingCompleted: me ? Boolean(me.completedAt) : null,
            serverCount: srv ? Number(srv.n) : null,
          }))
          .catch((err: unknown) => {
            console.warn("[dashboard] onboarding gate lookup failed:", err);
            return null;
          }),
  ]);
  const { plan } = signals;
  const showTeam = plan === "team" || (teamRow?.n ?? 0) > 0;

  // A signed-in account that never finished (nor skipped) onboarding and has
  // no server yet goes to the wizard; the client gate exempts Billing and
  // Settings (lib/auth/return-to.ts).
  const gateActive = needsOnboarding({
    isAdmin,
    onboardingCompleted: gate?.onboardingCompleted ?? null,
    serverCount: gate?.serverCount ?? null,
    teamMember: (teamRow?.n ?? 0) > 0,
  });

  // The one upgrade decision (lib/billing/upgrade-state.ts): the strip under
  // the header and the nav link both read from it.
  const nudge = computeUpgradeNudge(signals);
  const bannerNudge: SerializedNudge = {
    ...nudge,
    resetsAt: nudge.resetsAt.toISOString(),
    trialEndsAt: nudge.trialEndsAt?.toISOString() ?? null,
  };

  // Admin-only "à relancer" nav badge: prospects with a past-due follow-up still
  // in play. Guarded — the prospects table may not exist yet (migration 0011
  // pending), and a nav badge must never 500 the whole dashboard.
  let prospectsDue = 0;
  let attention = 0;
  if (isAdmin) {
    try {
      const [due] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(prospects)
        .where(
          sql`${prospects.nextActionAt} is not null and ${prospects.nextActionAt} <= now() and ${prospects.status} not in ('won','lost')`
        );
      prospectsDue = due?.n ?? 0;
      // Combined "À traiter" cockpit badge (due follow-ups + error/stuck servers
      // + new leads). Guarded so a table hiccup never 500s the dashboard.
      attention = await attentionCount();
    } catch {
      prospectsDue = 0;
      attention = 0;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <DashboardNav
        email={user.email ?? ""}
        plan={plan}
        isAdmin={isAdmin}
        prospectsDue={prospectsDue}
        attentionCount={attention}
        showTeam={showTeam}
        trialEligible={nudge.trialEligible}
      />
      {/* Bone stock beside the sidebar: 16 px gutters on mobile; min-w-0 so a wide
          ledger table scrolls inside its card instead of widening the column. */}
      <main
        id="main-content"
        className="w-full min-w-0 max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-10"
      >
        {nudge.level !== "none" && <UpgradeBanner nudge={bannerNudge} />}
        <OnboardingGate active={gateActive}>{children}</OnboardingGate>
      </main>
    </div>
  );
}
