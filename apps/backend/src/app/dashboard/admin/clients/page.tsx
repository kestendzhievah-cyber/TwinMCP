import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Separator } from "@/components/ui/separator";
import { ClientsPanel } from "./clients-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients · TwinMCP" };

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard/admin/clients");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          Administration
        </p>
        <h1 className="smallcaps tracking-sc mt-2 text-2xl font-medium">Clients</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Tous vos comptes clients — plan, serveurs, MCPs, usage et état, en un coup d'œil. Visible
          par les admins uniquement.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      <ClientsPanel />
    </div>
  );
}
