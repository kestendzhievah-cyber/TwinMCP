import { UsagePanel } from "./panel";

export const dynamic = "force-dynamic";

export default function UsagePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          MCP requests handled by your boxes, error rate over time, and API activity.
        </p>
      </div>
      <UsagePanel />
    </div>
  );
}
