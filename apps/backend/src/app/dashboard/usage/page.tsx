import { createClient } from "@/utils/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { UsagePanel } from "./panel";
import { CostSection } from "./cost-section";
import { CustomersSection } from "./customers-section";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Usage"
        description="What your usage costs per day, tool calls handled by your MCPs, error rate, and API activity."
      />
      {/* Euros per day from the credit ledger (server-rendered). */}
      {user && <CostSection userId={user.id} />}
      <UsagePanel />
      {/* Agencies: tool calls per end customer (the id set on an MCP-proxy key). */}
      <CustomersSection />
    </div>
  );
}
