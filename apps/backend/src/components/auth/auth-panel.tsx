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

export function AuthPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden border-l border-border/60 bg-muted/40 px-10 py-12 lg:px-12">
      {/* subtle gradient halo, neutral */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--secondary))_0%,_transparent_50%)]"
      />

      <div>
        <Logo />
        <h2 className="mt-12 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
          Why developers pick{" "}
          <span className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">
            TwinMCP
          </span>
        </h2>
        <ul className="mt-8 space-y-5">
          {reasons.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border/80 bg-background/80 text-foreground"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <figure className="mt-10 rounded-xl border border-border/80 bg-background/60 p-5">
        <blockquote className="text-sm leading-relaxed text-foreground/90">
          <span className="text-muted-foreground" aria-hidden>
            &ldquo;
          </span>
          Migrated 4 MCP servers off our VPS in one afternoon. The kind of infra you don&apos;t
          want to be on call for.
          <span className="text-muted-foreground" aria-hidden>
            &rdquo;
          </span>
        </blockquote>
        <figcaption className="mt-3 flex items-center gap-3 text-xs">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-full bg-secondary font-mono text-[10px] font-semibold text-foreground"
          >
            TB
          </span>
          <span>
            <span className="block font-medium text-foreground">Tarek B.</span>
            <span className="block text-muted-foreground">Staff engineer · infra</span>
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
