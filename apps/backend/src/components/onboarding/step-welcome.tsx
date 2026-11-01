"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, Code2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { OfferBadge, offerFacts } from "@/components/marketing/offer-badge";
import { OfferFacts } from "@/components/marketing/offer-band";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { minTopupLabel } from "@/lib/wallet/pricing";
import type { IdeKey } from "@/lib/mcp/client-config";

// The IDE choice is the same set the config generator knows (lib/mcp/client-
// config.ts), so every tile has a working snippet on the Connect step.
export type IdePreference = IdeKey;

// What the sign-up credit buys, from the wallet price list (lib/wallet/pricing.ts).
const W = walletFacts("en");

const ides: Array<{ id: IdePreference; label: string; hint: string }> = [
  { id: "cursor", label: "Cursor", hint: "~/.cursor/mcp.json" },
  { id: "claude-code", label: "Claude Code", hint: "claude mcp add" },
  { id: "claude-desktop", label: "Claude Desktop", hint: "claude_desktop_config.json" },
  { id: "vscode", label: "VS Code", hint: "Copilot · .vscode/mcp.json" },
  { id: "windsurf", label: "Windsurf", hint: "mcp_config.json" },
  { id: "cline", label: "Cline", hint: "VS Code extension" },
  { id: "zed", label: "Zed", hint: "settings.json" },
  { id: "other", label: "Other", hint: "Any MCP client" },
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

const TITLE = "font-display text-2xl font-bold tracking-tight sm:text-3xl";

export function StepWelcome({
  selected,
  onSelect,
  onContinue,
  onBack,
  credit = null,
}: StepWelcomeProps) {
  return (
    <div className="space-y-8">
      {credit?.status === "granted" ? (
        <CreditWelcome credit={credit} />
      ) : (
        <div>
          <h2 className={TITLE}>Let&apos;s get you running in about 2 minutes.</h2>
          <p className="mt-2 text-base text-muted-foreground">
            A few quick choices and you&apos;ll have a live MCP server wired into your AI client.
          </p>
          {credit && <CreditLine credit={credit} />}
        </div>
      )}

      <div>
        <h3 id="ide-choice" className="mb-3 text-sm font-semibold">
          Which AI client do you use?
        </h3>
        {/* Choice tiles: the client's logo, its name and where its config
            lives. The chosen one is outlined in brand blue. VS Code is text
            only (no Microsoft mark). */}
        <div
          role="group"
          aria-labelledby="ide-choice"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {ides.map((ide) => {
            const active = selected === ide.id;
            return (
              <button
                key={ide.id}
                type="button"
                onClick={() => onSelect(ide.id)}
                className={cn(
                  "relative flex min-w-0 flex-col items-start gap-2 rounded-xl border bg-card p-3.5 pr-8 text-left transition-[border-color,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4 sm:pr-9",
                  active
                    ? "border-brand bg-brand/5 ring-1 ring-brand"
                    : "border-border hover:border-input hover:shadow-md"
                )}
                aria-pressed={active}
              >
                {hasBrandLogo(ide.id) ? (
                  <BrandLogo slug={ide.id} size={24} decorative />
                ) : (
                  <Code2 aria-hidden className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold">{ide.label}</span>
                <span className="break-all font-mono text-xs text-muted-foreground">
                  {ide.hint}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-foreground"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onContinue} disabled={!selected} size="lg">
          Next: create my server
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/**
 * The welcome header when the sign-up credit was granted: the offer badge,
 * the credit as the headline, and what it buys in three cells (the same
 * facts as the home page's offer band, in mini form).
 */
function CreditWelcome({ credit }: { credit: Extract<SignupCreditView, { status: "granted" }> }) {
  return (
    <div>
      <OfferBadge size="sm" />
      <h2 className={cn(TITLE, "mt-4")}>
        Your <span className="text-primary tabular-nums">{credit.amount}</span> free credit is ready
      </h2>
      <p className="mt-2 text-base text-muted-foreground tabular-nums">
        {credit.expiresAt
          ? `Valid until ${formatDate(credit.expiresAt)}.`
          : `Valid ${W.signupDays} days.`}{" "}
        No card needed. Pick your AI client and your first server is live in about 2 minutes.
      </p>
      <CreditFacts className="mt-5" />
    </div>
  );
}

/**
 * What the sign-up credit buys: the home page's offer-band cells in mini form
 * (OfferFacts), on the soft-pink offer surface, with the mandatory small print.
 */
function CreditFacts({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-offer-border bg-offer p-3 sm:p-4", className)}>
      <OfferFacts size="sm" />
      <p className="mt-3 text-xs text-offer-foreground">{offerFacts("en").smallPrint}</p>
    </div>
  );
}

/** One line under the welcome title when the credit was not granted here. */
function CreditLine({ credit }: { credit: SignupCreditView }) {
  if (credit.status === "granted") return null;
  if (credit.status === "funded") {
    return (
      <div className="mt-4">
        <Badge variant="success">Pay as you go</Badge>
      </div>
    );
  }
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {credit.message}
        {/* Unconfirmed address: the action is to confirm it, not to pay. */}
        {credit.reason !== "unverified" && (
          <>
            {" "}
            <Link
              href={"/dashboard/billing" as Route}
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Top up from {minTopupLabel()}
            </Link>{" "}
            to start.
          </>
        )}
      </span>
    </p>
  );
}
