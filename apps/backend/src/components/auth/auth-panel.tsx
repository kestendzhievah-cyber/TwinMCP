import { ShieldCheck, Zap, Layers, Workflow } from "lucide-react";
import { Logo } from "@/components/marketing/logo";

const reasons = [
  {
    icon: Zap,
    title: "Provision in under 10 seconds",
    body: "Pick a runtime, name your server, ship. No Dockerfile, no VPS to keep warm.",
  },
  {
    icon: Layers,
    title: "Curated MCPs out of the box",
    body: "Filesystem, GitHub, fetch, postgres, plus a docs MCP wired to your stack.",
  },
  {
    icon: Workflow,
    title: "One config, every IDE",
    body: "The same TwinMCP server URL drops into Cursor, Claude Code, Windsurf, Cline.",
  },
  {
    icon: ShieldCheck,
    title: "Audit logs and per-key URLs",
    body: "Every request is attributable, every key revocable. Security review-ready.",
  },
];

// The reverse of the card: a shade darker bone behind a left hairline, the
// wordmark, a ruled ledger of reasons, and the card itself — the one piece of
// "product" on the page — sitting on the stacked-card shadow.
export function AuthPanel() {
  return (
    <div className="flex h-full flex-col justify-between border-l border-border bg-secondary/40 px-10 py-12 lg:px-12">
      <div>
        <Logo />
        <h2 className="mt-12 text-balance text-2xl font-medium md:text-3xl">
          Why developers pick TwinMCP
        </h2>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {reasons.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4 py-4">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="smallcaps tracking-sc text-base font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* The card itself — verifiable facts only, no testimonials. */}
      <div className="mt-10 border border-border bg-card p-6 text-center shadow-stack">
        <p className="smallcaps text-lg font-medium tracking-[0.14em]">TwinMCP</p>
        <p className="smallcaps mt-1 text-[0.625rem] tracking-[0.24em] text-muted-foreground">
          Managed MCP Runtimes
        </p>
        <div className="rule-double my-5" />
        <dl className="lining grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="smallcaps tracking-sc text-xs text-muted-foreground">Free tier</dt>
            <dd className="mt-1 text-2xl font-medium">1</dd>
            <dd className="text-xs italic text-muted-foreground">server</dd>
          </div>
          <div>
            <dt className="smallcaps tracking-sc text-xs text-muted-foreground">Official</dt>
            <dd className="mt-1 text-2xl font-medium">5</dd>
            <dd className="text-xs italic text-muted-foreground">MCPs included</dd>
          </div>
          <div>
            <dt className="smallcaps tracking-sc text-xs text-muted-foreground">Card</dt>
            <dd className="mt-1 text-2xl font-medium">0</dd>
            <dd className="text-xs italic text-muted-foreground">credit cards asked</dd>
          </div>
        </dl>
        <div className="my-5 h-px bg-border" />
        <p className="smallcaps tracking-sc text-xs text-muted-foreground">
          twinmcp.fr · hello@twinmcp.fr · security@twinmcp.fr
        </p>
      </div>
    </div>
  );
}
