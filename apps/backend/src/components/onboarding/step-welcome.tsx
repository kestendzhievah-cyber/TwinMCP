"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type IdePreference = "cursor" | "claude-code" | "windsurf" | "cline" | "zed" | "other";

const ides: Array<{ id: IdePreference; label: string; hint: string }> = [
  { id: "cursor", label: "Cursor", hint: "~/.cursor/mcp.json" },
  { id: "claude-code", label: "Claude Code", hint: "settings.json" },
  { id: "windsurf", label: "Windsurf", hint: "mcp_config.json" },
  { id: "cline", label: "Cline", hint: "VS Code extension" },
  { id: "zed", label: "Zed", hint: "settings.json" },
  { id: "other", label: "Other", hint: "Generic JSON-RPC client" },
];

interface StepWelcomeProps {
  selected: IdePreference | null;
  onSelect: (ide: IdePreference) => void;
  onContinue: () => void;
  onBack?: () => void;
  selectedPlan?: string | null;
}

export function StepWelcome({
  selected,
  onSelect,
  onContinue,
  onBack,
  selectedPlan,
}: StepWelcomeProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Let&apos;s get you running in 2 minutes.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A few quick choices and you&apos;ll have a live MCP server wired into your IDE.
        </p>
        {selectedPlan && (
          <Badge variant="secondary" className="mt-3 capitalize">
            Selected plan: {selectedPlan}
          </Badge>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Which IDE do you use?</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {ides.map((ide) => {
            const active = selected === ide.id;
            return (
              <button
                key={ide.id}
                type="button"
                onClick={() => onSelect(ide.id)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition-colors",
                  active
                    ? "border-foreground/40 ring-1 ring-foreground/20"
                    : "border-border/80 hover:border-foreground/20"
                )}
                aria-pressed={active}
              >
                <span className="text-sm font-semibold tracking-tight">{ide.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{ide.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onContinue} disabled={!selected} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
