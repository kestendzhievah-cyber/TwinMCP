import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">À traiter</h1>
        <p className="text-sm text-muted-foreground">
          Votre cockpit du jour — uniquement ce qui demande une action. Visible par les admins
          uniquement.
        </p>
      </div>
      <CockpitPanel />
    </div>
  );
}
