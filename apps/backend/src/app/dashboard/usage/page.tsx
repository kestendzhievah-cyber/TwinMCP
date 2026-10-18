import { Separator } from "@/components/ui/separator";
import { UsagePanel } from "./panel";

export const dynamic = "force-dynamic";

export default function UsagePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Usage</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          MCP requests handled by your boxes, error rate over time, and API activity.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>
      <UsagePanel />
    </div>
  );
}
