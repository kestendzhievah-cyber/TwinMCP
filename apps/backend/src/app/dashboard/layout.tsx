import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardNav email={user.email ?? ""} />
      <main className="flex-1 px-8 py-8 max-w-5xl">{children}</main>
    </div>
  );
}
