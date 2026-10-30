"use client";

import Link from "next/link";
import type { Route } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { minTopupLabel } from "@/lib/wallet/pricing";
import type { IdeKey } from "@/lib/mcp/client-config";

// The IDE choice is the same set the config generator knows (lib/mcp/client-
// config.ts), so every tile has a working snippet on the Connect step.
export type IdePreference = IdeKey;

const ides: Array<{ id: IdePreference; label: string; hint: string }> = [
  { id: "cursor", label: "Cursor", hint: "~/.cursor/mcp.json" },
  { id: "claude-code", label: "Claude Code", hint: "claude mcp add" },
  { id: "claude-desktop", label: "Claude Desktop", hint: "claude_desktop_config.json" },
  { id: "vscode", label: "VS Code", hint: "Copilot · .vscode/mcp.json" },
  { id: "windsurf", label: "Windsurf", hint: "mcp_config.json" },
  { id: "cline", label: "Cline", hint: "VS Code extension" },
  { id: "zed", label: "Zed", hint: "settings.json" },
  { id: "other", label: "Other", hint: "Generic JSON-RPC client" },
];

/**
 * What the sign-up credit did for this account (app/onboarding/page.tsx):
 * granted (amount + expiry), refused (why, with a top-up link), or the
 * account is already funded.
 */
export type SignupCreditView =
  | { status: "granted"; amount: string; expiresAt: string | null }
  | { status: "refused"; message: string; reason?: string }
  | { status: "funded" };

interface StepWelcomeProps {
  selected: IdePreference | null;
  onSelect: (ide: IdePreference) => void;
  onContinue: () => void;
  onBack?: () => void;
  /** The sign-up credit line (null: say nothing). */
  credit?: SignupCreditView | null;
}

export function StepWelcome({
  selected,
  onSelect,
  onContinue,
  onBack,
  credit = null,
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
        {credit && <CreditLine credit={credit} />}
      </div>

      <div>
        <p className="smallcaps tracking-sc mb-3 text-sm font-medium">Which IDE do you use?</p>
        {/* Choice tiles: hairline cards; the chosen one is pressed into the stock. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

const TOP_UP = "text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

/** One memo line under the welcome title (DESIGN.md §5 callouts). */
function CreditLine({ credit }: { credit: SignupCreditView }) {
  if (credit.status === "granted") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant="success" className="lining">
          {credit.amount} of free credit added
        </Badge>
        <span className="lining text-sm italic text-muted-foreground">
          {credit.expiresAt ? `Valid until ${formatDate(credit.expiresAt)}. ` : ""}No card needed.
        </span>
      </div>
    );
  }
  if (credit.status === "funded") {
    return (
      <div className="mt-4">
        <Badge variant="success">Pay as you go</Badge>
      </div>
    );
  }
  // Unconfirmed address: the action is to confirm it, not to pay.
  if (credit.reason === "unverified") {
    return (
      <p className="mt-4 border border-l-2 border-info/40 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
        {credit.message}
      </p>
    );
  }
  return (
    <p className="mt-4 border border-l-2 border-info/40 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
      {credit.message}{" "}
      <Link href={"/dashboard/billing" as Route} className={cn("font-medium", TOP_UP)}>
        Top up from {minTopupLabel()}
      </Link>{" "}
      to start.
    </p>
  );
}
