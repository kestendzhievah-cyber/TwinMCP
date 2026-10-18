import { Boxes, Store, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fakeServers = [
  { name: "prod-cluster", slug: "prod-cluster-7f3a", status: "running", region: "fra1" },
  { name: "staging", slug: "staging-2c8b", status: "running", region: "iad1" },
  { name: "data-pipeline", slug: "data-pipeline-9e1d", status: "provisioning", region: "fra1" },
];

const statusVariant = {
  running: "success",
  provisioning: "warning",
} as const;

// The product, drawn as a card on the stack: a hairline title bar with the
// address in typewriter, a small-caps sidebar with an ink rule on the active
// item, and a ledger of servers (DESIGN.md §4.10).
export function HeroMockup() {
  return (
    <div
      aria-hidden
      className="relative w-full max-w-xl select-none overflow-hidden border border-foreground/60 bg-card shadow-stack"
    >
      {/* title bar */}
      <div className="flex h-9 items-center justify-between border-b border-border bg-secondary/60 px-4">
        <span className="truncate font-mono text-xs text-muted-foreground">
          twinmcp.fr/dashboard/servers
        </span>
        <span className="smallcaps tracking-sc text-xs text-muted-foreground">Control plane</span>
      </div>

      {/* layout */}
      <div className="grid grid-cols-[1fr] text-xs sm:grid-cols-[150px_1fr]">
        {/* sidebar */}
        <div className="hidden border-r border-border p-3 sm:block">
          <div className="mb-4 px-2">
            <p className="smallcaps text-sm font-medium tracking-[0.14em]">TwinMCP</p>
            <p className="smallcaps text-[0.625rem] tracking-[0.22em] text-muted-foreground">
              Managed MCP Runtimes
            </p>
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
                  "smallcaps tracking-sc flex items-center gap-2 border-l-2 py-1.5 pl-2 " +
                  (active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* main */}
        <div className="p-4">
          <div className="mb-3 flex items-end justify-between border-b-[3px] border-double border-border pb-3">
            <div>
              <p className="smallcaps tracking-sc text-sm font-medium">Servers</p>
              <p className="lining text-xs italic text-muted-foreground">3 active · Pro plan</p>
            </div>
            <span className="smallcaps tracking-sc border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
              New server
            </span>
          </div>

          <table className="lining w-full text-xs">
            <thead>
              <tr className="smallcaps tracking-sc border-b border-foreground/50 text-left text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Name</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 font-medium">Region</th>
              </tr>
            </thead>
            <tbody>
              {fakeServers.map((s) => (
                <tr key={s.slug} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-foreground">{s.name}</p>
                    <p className="truncate font-mono text-muted-foreground">{s.slug}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge
                      variant={statusVariant[s.status as keyof typeof statusVariant]}
                      className="capitalize"
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td className="py-2 font-mono text-muted-foreground">{s.region}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between border border-border bg-secondary/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">prod-cluster · 8 MCPs installed</span>
            <span className="smallcaps tracking-sc text-muted-foreground">Details</span>
          </div>
        </div>
      </div>
    </div>
  );
}
