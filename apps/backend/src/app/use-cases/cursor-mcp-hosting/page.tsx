import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug } from "@/lib/use-cases/registry";

const SLUG = "cursor-mcp-hosting";
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
    title: "Two-minute setup",
    body: "Pick a runtime, install one or more MCPs from the marketplace, and paste the ready-made snippet into Cursor's MCP config. No Docker, no TLS, no env-var juggling.",
  },
  {
    title: "Per-server isolation",
    body: "Each MCP runs in its own Upstash Box sandbox with encrypted secrets and a per-user API key. A misbehaving tool cannot touch anything else you run.",
  },
  {
    title: "Works across IDEs",
    body: "Cursor today, Claude Desktop tomorrow, Windsurf next week. The same hosted MCP works in all of them — one URL, one token, zero re-installation.",
  },
];

const steps = [
  {
    title: "Sign up for the free tier",
    body: "No credit card. You get one server slot and access to the full MCP marketplace immediately.",
  },
  {
    title: "Create a server and install an MCP",
    body: "Pick the runtime (Node, Python, Go, Ruby, or Rust). Choose GitHub, Postgres, Notion, Slack, or anything else from the catalogue.",
  },
  {
    title: "Copy the Cursor snippet",
    body: "The dashboard shows the exact JSON to paste into ~/.cursor/mcp.json — URL, headers, and Authorization Bearer.",
  },
  {
    title: "Reload Cursor and use the tools",
    body: "Open the MCP panel in Cursor, hit reload, watch the tools light up green. The model can now use them in chat and inline edits.",
  },
];

const faq = [
  {
    q: "Does this replace running MCP servers locally with stdio?",
    a: "It complements stdio. Keep stdio for personal local tools (filesystem, scratchpad). Use hosted MCPs for anything that holds a token, needs persistence, or should be shared with teammates.",
  },
  {
    q: "Can I use a hosted MCP and a local stdio MCP at the same time in Cursor?",
    a: "Yes. Cursor merges all configured servers — both transports appear together in the MCP panel and the model sees a unified tool catalogue.",
  },
  {
    q: "What runtimes does TwinMCP support for Cursor MCP hosting?",
    a: "Node.js, Python, Go, Ruby, and Rust — the runtimes pre-installed on Upstash Box. Any npm or pip package that runs on a regular machine runs on TwinMCP without modification.",
  },
  {
    q: "Is the free tier enough to evaluate Cursor MCP hosting?",
    a: "Yes. The free tier includes one server, the marketplace catalogue, live logs, and unlimited tool calls within sane fair-use limits. Most personal evaluations never need to upgrade.",
  },
  {
    q: "How do I rotate the Cursor MCP API key?",
    a: "From your dashboard, two clicks: generate a new key, paste it into Cursor's config, the old one stays valid for a short grace period so nothing breaks during the swap.",
  },
];

export default function CursorMcpHostingPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="mb-20">
        <h2 className="text-3xl font-semibold tracking-tight">
          The Cursor config snippet you actually paste
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Every hosted MCP in your dashboard exposes a ready-to-copy snippet for{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.875em]">
            ~/.cursor/mcp.json
          </code>
          . No path resolution, no{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.875em]">
            command
          </code>{" "}
          and{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.875em]">args</code>{" "}
          wrangling — just URL and token.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          <code>{`{
  "mcpServers": {
    "github-prod": {
      "url": "https://github.your-team.twinmcp.fr/sse",
      "headers": {
        "Authorization": "Bearer tw_live_..."
      }
    }
  }
}`}</code>
        </pre>
        <p className="mt-6 text-sm text-muted-foreground">
          Need a deeper walk-through of Cursor&apos;s MCP config?{" "}
          <Link
            href={"/blog/cursor-mcp-setup" as Route}
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Read the Cursor MCP setup guide
          </Link>
          .
        </p>
      </section>
    </UseCaseLayout>
  );
}
