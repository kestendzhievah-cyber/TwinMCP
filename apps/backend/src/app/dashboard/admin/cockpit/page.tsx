import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Separator } from "@/components/ui/separator";
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
    <div className="space-y-8">
      <div>
        <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          Administration
        </p>
        <h1 className="smallcaps tracking-sc mt-2 text-2xl font-medium">À traiter</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Votre cockpit du jour — uniquement ce qui demande une action. Visible par les admins
          uniquement.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      <CockpitPanel />
    </div>
  );
}
