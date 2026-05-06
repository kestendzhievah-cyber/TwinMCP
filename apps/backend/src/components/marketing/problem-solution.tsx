import { CheckCircle2, XCircle } from "lucide-react";
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
      <div className="grid gap-6 md:grid-cols-2">
        <Column
          tone="negative"
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          title="Without TwinMCP"
          items={without}
          itemIcon={<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />}
        />
        <Column
          tone="positive"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          title="With TwinMCP"
          items={withTwin}
          itemIcon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
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
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-6 md:p-7",
        tone === "negative"
          ? "border-destructive/30"
          : "border-emerald-500/30 shadow-sm shadow-emerald-500/[0.03]"
      )}
    >
      <div className="mb-5 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold tracking-tight">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
            {itemIcon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
