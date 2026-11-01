import { Check, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ActivationLink, type ActivationStep } from "@/components/onboarding/activation-link";
import { CreditMeter } from "@/components/billing/credit-meter";
import { cn } from "@/lib/utils";

/**
 * "Getting started" on the dashboard overview: the steps from a new account
 * to its first tool call, each either done or a link to the place where it
 * gets done. The next step's button is the page's primary action (unless the
 * page hands the primary to a top-up). Once every step is done the card
 * collapses to a one-line success strip. The flags are computed on the
 * overview from the DB.
 */

export interface ActivationState {
  /** A server that is not destroyed. */
  hasServer: boolean;
  /** An installed MCP other than the built-in TwinMCP Docs. */
  hasMcp: boolean;
  /** An active (non-revoked) API key. */
  hasKey: boolean;
  /** A key has been used at least once (an IDE or the test reached the proxy). */
  ideConnected: boolean;
  /** users.metadata.firstToolCallAt, or any request recorded in usage_metrics. */
  firstToolCall: boolean;
  /** The user's first server, for the key / connect links. */
  serverId: string | null;
}

export function isActivated(s: ActivationState): boolean {
  return s.hasServer && s.hasMcp && s.hasKey && s.ideConnected && s.firstToolCall;
}

interface Row {
  step: ActivationStep;
  done: boolean;
  label: string;
  doneLabel: string;
  href: string;
  cta: string;
}

export function ActivationChecklist({
  state,
  primary = true,
  className,
}: {
  state: ActivationState;
  /** The next step's button is the page's rose primary (false: outline). */
  primary?: boolean;
  className?: string;
}) {
  if (isActivated(state)) {
    return (
      <p
        role="status"
        className={cn(
          "flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground",
          className
        )}
      >
        <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-success" />
        <span>
          <span className="font-semibold">You&apos;re live.</span> Your first tool call went
          through: every step of the setup is done.
        </span>
      </p>
    );
  }

  const serverHref = state.serverId
    ? `/dashboard/servers/${state.serverId}`
    : "/onboarding?force=1&step=2";

  const rows: Row[] = [
    {
      step: "server",
      done: state.hasServer,
      label: "Create your server",
      doneLabel: "Server created",
      href: "/onboarding?force=1&step=2",
      cta: "Create server",
    },
    {
      step: "mcp",
      done: state.hasMcp,
      label: "Install an MCP from the marketplace",
      doneLabel: "MCP installed",
      href: "/dashboard/marketplace",
      cta: "Add an MCP",
    },
    {
      step: "key",
      done: state.hasKey,
      label: "Get an API key on your server page",
      doneLabel: "API key created",
      href: serverHref,
      cta: "Get a key",
    },
    {
      step: "connect",
      done: state.ideConnected,
      label: "Paste the config into your client",
      doneLabel: "Client connected",
      href: serverHref,
      cta: "Copy config",
    },
    {
      step: "first_call",
      done: state.firstToolCall,
      label: "Ask your client to use a tool: the call appears in Logs",
      doneLabel: "First tool call made",
      href: serverHref,
      cta: "Open logs",
    },
  ];
  const doneCount = rows.filter((r) => r.done).length;
  const nextIndex = rows.findIndex((r) => !r.done);

  return (
    <Card className={className}>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle as="h2">Getting started</CardTitle>
          <span className="text-sm tabular-nums text-muted-foreground">
            {doneCount} of {rows.length} done
          </span>
        </div>
        <CreditMeter
          share={doneCount / rows.length}
          label="Setup progress"
          trackClassName="bg-secondary"
          fillClassName="bg-brand"
        />
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {rows.map((row, i) => {
            const isNext = i === nextIndex;
            return (
              <li key={row.step} className="flex items-start gap-3 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                    row.done
                      ? "bg-success text-success-foreground"
                      : isNext
                        ? "border-2 border-brand text-brand"
                        : "border-2 border-input text-muted-foreground"
                  )}
                >
                  {row.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  {row.done ? (
                    <span className="text-muted-foreground">
                      <span className="sr-only">Done: </span>
                      {row.doneLabel}
                    </span>
                  ) : isNext ? (
                    <>
                      <span className="font-semibold text-foreground">{row.label}</span>
                      <div className="mt-2">
                        <ActivationLink
                          step={row.step}
                          href={row.href}
                          className={cn(
                            buttonVariants({
                              variant: primary ? "default" : "outline",
                              size: "sm",
                            }),
                            "no-underline"
                          )}
                        >
                          {row.cta}
                        </ActivationLink>
                      </div>
                    </>
                  ) : (
                    <ActivationLink
                      step={row.step}
                      href={row.href}
                      className="font-normal text-muted-foreground no-underline hover:text-brand hover:underline"
                    >
                      {row.label}
                    </ActivationLink>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
