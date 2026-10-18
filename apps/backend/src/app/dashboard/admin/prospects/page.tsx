import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Separator } from "@/components/ui/separator";
import { ProspectsPanel } from "./prospects-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prospection · TwinMCP" };

export default async function ProspectsPage() {
  // Hard gate: only allowlisted admins reach the CRM. Non-admins are bounced to
  // their own dashboard (the API is gated server-side regardless of this check).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?returnTo=/dashboard/admin/prospects");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          Administration
        </p>
        <h1 className="smallcaps tracking-sc mt-2 text-2xl font-medium">Prospection</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Votre pipeline commercial — suivez vos prospects, relancez au bon moment et envoyez un
          email pré-rédigé en un clic. Visible par les admins uniquement.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      <ProspectsPanel />
    </div>
  );
}
