import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Separator } from "@/components/ui/separator";
import { AdminAnalyticsPanel } from "./panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin analytics · TwinMCP" };

export default async function AdminPage() {
  // Hard gate: only allowlisted admins reach this page. Non-admins are bounced
  // back to their own dashboard rather than shown an error.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard/admin");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          Administration
        </p>
        <h1 className="smallcaps tracking-sc mt-2 text-2xl font-medium">Admin analytics</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Live platform stats, straight from the database. Visible to admins only.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      <AdminAnalyticsPanel />
    </div>
  );
}
