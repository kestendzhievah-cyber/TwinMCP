"use client";

import { Check } from "lucide-react";
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-medium md:text-3xl">
          Let&apos;s get you running in 2 minutes.
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          A few quick choices and you&apos;ll have a live MCP server wired into your IDE.
        </p>
        {selectedPlan && (
          <Badge variant="brand" className="mt-4 capitalize">
            Selected plan: {selectedPlan}
          </Badge>
        )}
      </div>

      <div>
        <p className="smallcaps tracking-sc mb-3 text-sm font-medium">Which IDE do you use?</p>
        {/* Choice tiles: hairline cards; the chosen one is pressed into the stock. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ides.map((ide) => {
            const active = selected === ide.id;
            return (
              <button
                key={ide.id}
                type="button"
                onClick={() => onSelect(ide.id)}
                className={cn(
                  "relative flex flex-col items-start gap-1 border bg-card p-4 pr-9 text-left transition-colors",
                  active
                    ? "border-foreground bg-secondary/50 shadow-press"
                    : "border-border hover:border-foreground/60"
                )}
                aria-pressed={active}
              >
                <span className="smallcaps tracking-sc text-sm font-medium">{ide.label}</span>
                <span className="break-all font-mono text-xs text-muted-foreground">
                  {ide.hint}
                </span>
                {active && (
                  <Check aria-hidden className="absolute right-3 top-3 h-4 w-4 text-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6">
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
