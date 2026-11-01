import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminPageHeader } from "./admin-ui";
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
    <div className="space-y-6 md:space-y-8">
      <AdminPageHeader
        title="Admin analytics"
        description="Live platform stats, straight from the database. Visible to admins only."
      />
      <AdminAnalyticsPanel />
    </div>
  );
}
