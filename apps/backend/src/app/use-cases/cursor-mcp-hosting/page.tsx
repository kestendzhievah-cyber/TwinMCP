import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug } from "@/lib/use-cases/registry";
import { FUNDED_UNLOCKS, SIGNUP_OFFER, WALLET_SUMMARY } from "@/components/pricing/wallet-copy";

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
    title: "Sign up with free credit",
    body: `${SIGNUP_OFFER.en}. You get one server slot and access to the full MCP marketplace immediately.`,
  },
  {
    title: "Create a server and install an MCP",
    body: "Pick the runtime (Node, Python, Go, Ruby, or Rust). Choose Postgres, Notion, Slack, GitLab, or anything else from the catalogue.",
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
    a: "It complements stdio. Keep stdio for personal local tools (filesystem, scratchpad). Use hosted MCPs for anything that holds a token, needs persistence, or should be reachable from more than one machine.",
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
    q: "Is the free credit enough to evaluate Cursor MCP hosting?",
    a: `Yes. ${WALLET_SUMMARY.en} ${FUNDED_UNLOCKS.en}`,
  },
  {
    q: "How do I rotate the Cursor MCP API key?",
    a: "From your dashboard, two clicks: generate a new key, paste it into Cursor's config, the old one stays valid for a short grace period so nothing breaks during the swap.",
  },
];

export default function CursorMcpHostingPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="border-t border-border py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Configuration</p>
          <h2 className="mt-4 text-balance text-3xl font-display font-bold tracking-tight md:text-4xl">
            The Cursor config snippet you actually paste
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every hosted MCP in your dashboard exposes a ready-to-copy snippet for{" "}
            <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">
              ~/.cursor/mcp.json
            </code>
            . No path resolution, no{" "}
            <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">
              command
            </code>{" "}
            and{" "}
            <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">
              args
            </code>{" "}
            wrangling — just URL and token.
          </p>
        </div>
        {/* Code block: a filename header over mono code. */}
        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-xl border border-border bg-surface-alt">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">~/.cursor/mcp.json</span>
            <span className="rounded-md border border-border bg-card px-1.5 font-mono text-xs leading-5 text-muted-foreground">
              json
            </span>
          </div>
          <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
            <code className="font-mono text-foreground">{`{
  "mcpServers": {
    "gitlab": {
      "url": "https://twinmcp.fr/api/mcp/your-server/gitlab",
      "headers": {
        "Authorization": "Bearer ctx7sk_YOUR_KEY_HERE"
      }
    }
  }
}`}</code>
          </pre>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          Need a deeper walk-through of Cursor&apos;s MCP config?{" "}
          <Link
            href={"/blog/cursor-mcp-setup" as Route}
            className="text-brand underline underline-offset-4 hover:decoration-2"
          >
            Read the Cursor MCP setup guide
          </Link>
          .
        </p>
      </section>
    </UseCaseLayout>
  );
}
