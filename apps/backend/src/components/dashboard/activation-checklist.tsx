import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivationLink, type ActivationStep } from "@/components/onboarding/activation-link";
import { cn } from "@/lib/utils";

/**
 * "Getting started" on the dashboard overview: the five steps from a new
 * account to its first tool call, each either done or a link to the place
 * where it gets done. The overview renders it only while a step is missing
 * (see `isActivated`), and the flags are computed there from the DB.
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
  doneLabel: string;
  todo: React.ReactNode;
}

export function ActivationChecklist({ state }: { state: ActivationState }) {
  if (isActivated(state)) return null;

  const serverHref = state.serverId
    ? `/dashboard/servers/${state.serverId}`
    : "/onboarding?force=1&step=2";

  const rows: Row[] = [
    {
      step: "server",
      done: state.hasServer,
      doneLabel: "Server created",
      todo: (
        <ActivationLink step="server" href="/onboarding?force=1&step=2">
          Create your server
        </ActivationLink>
      ),
    },
    {
      step: "mcp",
      done: state.hasMcp,
      doneLabel: "MCP installed",
      todo: (
        <ActivationLink step="mcp" href="/dashboard/marketplace">
          Install an MCP from the marketplace
        </ActivationLink>
      ),
    },
    {
      step: "key",
      done: state.hasKey,
      doneLabel: "API key created",
      todo: (
        <ActivationLink step="key" href={serverHref}>
          Get an API key on your server page
        </ActivationLink>
      ),
    },
    {
      step: "connect",
      done: state.ideConnected,
      doneLabel: "IDE connected",
      todo: (
        <ActivationLink step="connect" href={serverHref}>
          Paste the config into your IDE
        </ActivationLink>
      ),
    },
    {
      step: "first_call",
      done: state.firstToolCall,
      doneLabel: "First tool call made",
      todo: (
        <span>
          Ask your IDE to use a tool —{" "}
          <ActivationLink step="first_call" href={serverHref}>
            the call appears in Logs
          </ActivationLink>
        </span>
      ),
    },
  ];
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <Card>
      <CardHeader className="border-b border-border px-6 py-4">
        <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          Getting started
        </p>
        <CardTitle className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-base">
          <span>From sign-up to your first tool call</span>
          <span className="lining text-sm font-normal italic text-muted-foreground">
            {doneCount} of {rows.length} done
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ol className="divide-y divide-border">
          {rows.map((row, i) => (
            <li key={row.step} className="flex items-start gap-3 px-6 py-3 text-sm">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center border text-xs",
                  row.done
                    ? "border-success/40 bg-success/10 text-success"
                    : "lining border-border text-muted-foreground"
                )}
              >
                {row.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {row.done ? (
                <span className="text-muted-foreground">
                  <span className="sr-only">Done: </span>
                  {row.doneLabel}
                </span>
              ) : (
                <span>{row.todo}</span>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
