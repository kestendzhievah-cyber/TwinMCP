import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug } from "@/lib/use-cases/registry";

const SLUG = "claude-mcp-hosting";
const useCase = getUseCaseBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

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
    a: "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. Windows: %APPDATA%\\Claude\\claude_desktop_config.json. Linux: ~/.config/Claude/claude_desktop_config.json. Or use Settings → Developer → Edit Config to open it directly.",
  },
];

export default function ClaudeMcpHostingPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="mb-20">
        <h2 className="text-3xl font-semibold tracking-tight">
          The Claude config snippets, ready to paste
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          TwinMCP generates the right config for whichever Claude client you use. Pick the tab in
          your dashboard, copy, paste. No path resolution, no environment-variable juggling.
        </p>
        <h3 className="mt-8 text-xl font-semibold">Claude Desktop</h3>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Claude Desktop does not read remote MCP URLs from{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.875em]">
            claude_desktop_config.json
          </code>
          . Add the server through the UI instead:{" "}
          <strong>Settings &rarr; Connectors &rarr; Add custom connector</strong>, paste the
          streamable-HTTP URL and bearer token from your TwinMCP dashboard. Claude Desktop handles
          the connection lifecycle automatically.
        </p>
        <h3 className="mt-6 text-xl font-semibold">Claude Code</h3>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          <code>{`claude mcp add github-prod \\
  --transport http \\
  https://github.your-team.twinmcp.dev/mcp \\
  --header "Authorization: Bearer tw_live_..."`}</code>
        </pre>
        <p className="mt-6 text-sm text-muted-foreground">
          For Claude Desktop quirks (path differences across OSes, why your config changes do not
          apply), read the full{" "}
          <Link
            href={"/blog/claude-desktop-mcp" as Route}
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Claude Desktop MCP installation guide
          </Link>
          .
        </p>
      </section>
    </UseCaseLayout>
  );
}
