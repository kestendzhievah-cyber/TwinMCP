import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminPageHeader } from "../admin-ui";
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
    <div className="space-y-6 md:space-y-8">
      <AdminPageHeader
        title="Clients"
        description="Tous vos comptes clients — plan, serveurs, MCPs, usage et état, en un coup d’œil. Visible par les admins uniquement."
      />
      <ClientsPanel />
    </div>
  );
}
