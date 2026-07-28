import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
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

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <DashboardNav email={user.email ?? ""} plan={plan} isAdmin={isAdmin} />
      <main className="w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
