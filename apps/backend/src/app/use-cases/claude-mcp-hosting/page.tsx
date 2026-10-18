import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug } from "@/lib/use-cases/registry";

const SLUG = "claude-mcp-hosting";
const useCase = getUseCaseBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: useCase.metaTitle,
  description: useCase.description,
  alternates: { canonical: `/use-cases/${SLUG}` },
  openGraph: {
    title: useCase.metaTitle,
    description: useCase.description,
    url: `${SITE_URL}/use-cases/${SLUG}`,
  },
};

const benefits = [
  {
    title: "Works with Claude Desktop and Claude Code",
    body: "The same hosted MCP is reachable from Claude Desktop (claude_desktop_config.json) and Claude Code (claude mcp add) without re-installation. One URL, one token, both clients.",
  },
  {
    title: "Secrets stay server-side",
    body: "Your GitHub token, your Slack bot key, your Postgres connection string — encrypted at rest, decrypted only inside the per-server sandbox. They never touch your laptop.",
  },
  {
    title: "Survives quitting Claude",
    body: "Hosted MCPs keep running between Claude restarts. State persists, scheduled jobs keep ticking, the cache stays warm.",
  },
];

const steps = [
  {
    title: "Sign up free",
    body: "One free server, marketplace access, no credit card. Two-minute onboarding.",
  },
  {
    title: "Install an MCP from the marketplace",
    body: "Pick GitHub, Notion, Slack, Postgres, or any of the curated MCPs. Provide the secret once; TwinMCP encrypts and stores it.",
  },
  {
    title: "Copy the Claude config snippet",
    body: "For Claude Desktop, paste into claude_desktop_config.json. For Claude Code, run claude mcp add with the URL and token shown in the dashboard.",
  },
  {
    title: "Fully quit and reopen Claude",
    body: "Claude Desktop only re-reads its config on a full quit (Cmd+Q on macOS), not a window close. After that, the new tools appear in the model's catalogue.",
  },
];

const faq = [
  {
    q: "Which Claude products work with TwinMCP-hosted MCPs?",
    a: "Both Claude Desktop and Claude Code connect to remote MCP servers. Claude Code accepts the URL via the CLI (claude mcp add --transport http). Claude Desktop accepts it through Settings → Connectors → Add custom connector — not through claude_desktop_config.json, which only handles local stdio servers.",
  },
  {
    q: "Can I share one hosted MCP between Claude Desktop on macOS and Claude Code in a terminal?",
    a: "Yes. The same URL and token work in both. Adding to Claude Code is one CLI command (claude mcp add); adding to Claude Desktop is a paste into the JSON config file.",
  },
  {
    q: "Do I need an Anthropic API key to use hosted MCPs?",
    a: "No. MCP is a transport between an AI client and a server. TwinMCP authenticates with its own per-user API key. Your Claude subscription is unrelated to your TwinMCP account.",
  },
  {
    q: "What happens to my MCP server if I close Claude?",
    a: "Nothing. The hosted server keeps running on TwinMCP — only your client connection drops. Reopen Claude and reconnection is instant; any background work the server was doing has continued.",
  },
  {
    q: "Where is the Claude Desktop config file again?",
    a: "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. Windows: %APPDATA%\Claude\claude_desktop_config.json. Linux: ~/.config/Claude/claude_desktop_config.json. Or use Settings → Developer → Edit Config to open it directly.",
  },
];

export default function ClaudeMcpHostingPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="rule-double py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            Configuration
          </p>
          <h2 className="mt-4 text-balance text-3xl font-medium md:text-4xl">
            The Claude config snippets, ready to paste
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            TwinMCP generates the right config for whichever Claude client you use. Pick the tab in
            your dashboard, copy, paste. No path resolution, no environment-variable juggling.
          </p>
        </div>
        {/* Two clients, one sheet split by a hairline */}
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border">
          <div className="md:pr-10">
            <h3 className="smallcaps tracking-sc text-lg font-medium">Claude Desktop</h3>
            <p className="mt-3 text-base text-muted-foreground">
              Claude Desktop does not read remote MCP URLs from{" "}
              <code className="bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">
                claude_desktop_config.json
              </code>
              . Add the server through the UI instead:{" "}
              <strong className="font-medium text-foreground">
                Settings &rarr; Connectors &rarr; Add custom connector
              </strong>
              , paste the streamable-HTTP URL and bearer token from your TwinMCP dashboard. Claude
              Desktop handles the connection lifecycle automatically.
            </p>
          </div>
          <div className="md:pl-10">
            <h3 className="smallcaps tracking-sc text-lg font-medium">Claude Code</h3>
            {/* Typewriter block: engraved tab, Courier on darker bone (DESIGN.md §4.6) */}
            <div className="mt-3 border border-border bg-secondary/60">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
                <span className="smallcaps tracking-sc text-xs text-muted-foreground">
                  Terminal
                </span>
                <span className="smallcaps tracking-sc border border-border px-1.5 text-xs leading-5 text-muted-foreground">
                  bash
                </span>
              </div>
              <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
                <code className="font-mono text-foreground">{`claude mcp add github-prod \
  --transport http \
  https://github.your-team.twinmcp.fr/mcp \
  --header "Authorization: Bearer tw_live_..."`}</code>
              </pre>
            </div>
          </div>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          For Claude Desktop quirks (path differences across OSes, why your config changes do not
          apply), read the full{" "}
          <Link
            href={"/blog/claude-desktop-mcp" as Route}
            className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
          >
            Claude Desktop MCP installation guide
          </Link>
          .
        </p>
      </section>
    </UseCaseLayout>
  );
}
