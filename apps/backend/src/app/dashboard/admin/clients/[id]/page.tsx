import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { ClientDetailPanel } from "./client-detail-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client · TwinMCP" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard/admin/clients");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const { id } = await params;
  return <ClientDetailPanel clientId={id} />;
}
