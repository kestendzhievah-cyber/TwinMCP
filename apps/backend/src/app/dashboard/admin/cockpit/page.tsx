import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminPageHeader } from "../admin-ui";
import { CockpitPanel } from "./cockpit-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "À traiter · TwinMCP" };

export default async function CockpitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard/admin/cockpit");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <div className="space-y-6 md:space-y-8">
      <AdminPageHeader
        title="À traiter"
        description="Votre cockpit du jour — uniquement ce qui demande une action. Visible par les admins uniquement."
      />
      <CockpitPanel />
    </div>
  );
}
