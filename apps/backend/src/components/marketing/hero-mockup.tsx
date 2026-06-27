import { Boxes, Store, Activity, MoreHorizontal } from "lucide-react";

const fakeServers = [
  { name: "prod-cluster", slug: "prod-cluster-7f3a", status: "running", region: "fra1" },
  { name: "staging", slug: "staging-2c8b", status: "running", region: "iad1" },
  { name: "data-pipeline", slug: "data-pipeline-9e1d", status: "provisioning", region: "fra1" },
];

const statusStyles: Record<string, string> = {
  running:
    "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-400/20",
  provisioning:
    "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20 dark:ring-amber-400/20",
};

export function HeroMockup() {
  return (
    <div
      aria-hidden
      className="relative w-full max-w-xl select-none overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/5 dark:shadow-black/40"
    >
      {/* fake titlebar */}
      <div className="flex h-9 items-center gap-1.5 border-b border-border/60 bg-muted/40 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">
          twinmcp.fr/dashboard/servers
        </span>
      </div>

      {/* layout */}
      <div className="grid grid-cols-[140px_1fr] text-[12px]">
        {/* sidebar */}
        <div className="border-r border-border/60 p-3">
          <div className="mb-3 flex items-center gap-1.5 px-1">
            <span className="grid h-4 w-4 place-items-center rounded bg-foreground text-[8px] font-bold text-background">
              T
            </span>
            <span className="font-semibold tracking-tight">TwinMCP</span>
          </div>
          <ul className="space-y-0.5">
            {[
              { icon: Boxes, label: "Servers", active: true },
              { icon: Store, label: "Marketplace" },
              { icon: Activity, label: "Logs" },
            ].map(({ icon: Icon, label, active }) => (
              <li
                key={label}
                className={
                  "flex items-center gap-2 rounded-md px-2 py-1.5 " +
                  (active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground")
                }
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* main */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold tracking-tight">Servers</p>
              <p className="text-[10px] text-muted-foreground">3 active · Pro plan</p>
            </div>
            <span className="rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background">
              + New server
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-border/60">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/60 bg-muted/30 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Name</span>
              <span>Status</span>
              <span>Region</span>
            </div>
            {fakeServers.map((s) => (
              <div
                key={s.slug}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{s.slug}</p>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize " +
                    statusStyles[s.status]
                  }
                >
                  {s.status}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{s.region}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px]">
            <span className="text-muted-foreground">prod-cluster · 8 MCPs installed</span>
            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
