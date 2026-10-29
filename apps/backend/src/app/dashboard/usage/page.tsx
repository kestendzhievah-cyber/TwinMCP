import { Separator } from "@/components/ui/separator";
import { getDailyLimit } from "@/lib/rate-limit";
import { UsagePanel } from "./panel";
import { CustomersSection } from "./customers-section";

export const dynamic = "force-dynamic";

export default function UsagePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Usage</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Tool calls handled by your MCPs, error rate over time, and API activity.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      {/* Pro's enforced quota (server only) so the near-limit prompt can name it. */}
      <UsagePanel proDailyLimit={getDailyLimit("pro")} />
      {/* Agencies: tool calls per end customer (the id set on an MCP-proxy key). */}
      <CustomersSection />
    </div>
  );
}
