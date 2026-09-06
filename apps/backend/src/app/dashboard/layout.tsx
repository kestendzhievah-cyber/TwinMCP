import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users, prospects } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { DashboardNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard");

  const [row] = await getDb()
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const plan = row?.plan ?? "free";
  const isAdmin = isAdminEmail(user.email);

  // Admin-only "à relancer" nav badge: prospects with a past-due follow-up still
  // in play. Guarded — the prospects table may not exist yet (migration 0011
  // pending), and a nav badge must never 500 the whole dashboard.
  let prospectsDue = 0;
  if (isAdmin) {
    try {
      const [due] = await getDb()
        .select({ n: sql<number>`count(*)::int` })
        .from(prospects)
        .where(
          sql`${prospects.nextActionAt} is not null and ${prospects.nextActionAt} <= now() and ${prospects.status} not in ('won','lost')`
        );
      prospectsDue = due?.n ?? 0;
    } catch {
      prospectsDue = 0;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <DashboardNav
        email={user.email ?? ""}
        plan={plan}
        isAdmin={isAdmin}
        prospectsDue={prospectsDue}
      />
      <main id="main-content" className="w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
