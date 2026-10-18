import { Check, X } from "lucide-react";
import { Section } from "./section";
import { cn } from "@/lib/utils";

const without = [
  "Copy-paste docs into a chat window every 30 min",
  "Hand-roll Docker / Coolify / VPS just to host an MCP",
  "Track and refresh API keys per IDE, per machine",
  "Lose context the moment you switch projects",
];

const withTwin = [
  "Live context streamed from MCPs you actually own",
  "One-click install of curated MCPs — no infra to babysit",
  "One API key per server, rotated and audited centrally",
  "Same servers across Cursor, Claude Code, Windsurf",
];

export function ProblemSolution() {
  return (
    <Section
      id="features"
      eyebrow="The problem"
      title="Your agent is only as good as its context"
      description="Most tools either lock you into a hosted endpoint or hand you a Docker file and wish you luck. TwinMCP runs the runtime so you keep ownership of your servers — without keeping a VPS warm."
    >
      {/* One sheet of card stock ruled down the middle: a two-column ledger. */}
      <div className="grid divide-y divide-border border border-border bg-card shadow-sm md:grid-cols-2 md:divide-x md:divide-y-0">
        <Column
          tone="negative"
          icon={<X className="h-4 w-4" />}
          title="Without TwinMCP"
          items={without}
          itemIcon={<X className="mt-1 h-4 w-4 shrink-0 text-destructive" />}
        />
        <Column
          tone="positive"
          icon={<Check className="h-4 w-4" />}
          title="With TwinMCP"
          items={withTwin}
          itemIcon={<Check className="mt-1 h-4 w-4 shrink-0 text-success" />}
        />
      </div>
    </Section>
  );
}

function Column({
  tone,
  icon,
  title,
  items,
  itemIcon,
}: {
  tone: "positive" | "negative";
  icon: React.ReactNode;
  title: string;
  items: string[];
  itemIcon: React.ReactNode;
}) {
  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 border-b border-foreground/50 pb-4">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center border",
            tone === "negative"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-success/40 bg-success/10 text-success"
          )}
        >
          {icon}
        </span>
        <h3 className="smallcaps tracking-sc text-lg font-medium">{title}</h3>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 py-3.5 text-base text-muted-foreground">
            {itemIcon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
