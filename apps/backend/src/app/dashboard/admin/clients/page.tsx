import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Tous vos comptes clients — plan, serveurs, MCPs, usage et état, en un coup d'œil. Visible
          par les admins uniquement.
        </p>
      </div>
      <ClientsPanel />
    </div>
  );
}
