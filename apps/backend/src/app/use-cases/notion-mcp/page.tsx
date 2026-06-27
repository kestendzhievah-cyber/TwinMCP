import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug } from "@/lib/use-cases/registry";

const SLUG = "notion-mcp";
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
    title: "Search, read, write Notion pages from your IDE",
    body: "Find the spec you wrote three months ago, pull its content into context, draft a follow-up page — all from inside Cursor, Claude Desktop, or Claude Code. No tab-switching.",
  },
  {
    title: "Notion token stays encrypted server-side",
    body: "Your integration secret never lives on your laptop. TwinMCP stores it encrypted at rest and only decrypts it inside the isolated sandbox that runs your Notion MCP.",
  },
  {
    title: "Respects Notion's permission model",
    body: "The MCP can only see pages and databases you explicitly shared with the integration. Notion's access controls remain the source of truth — TwinMCP never escalates them.",
  },
];

const steps = [
  {
    title: "Create a Notion internal integration",
    body: "From notion.so/my-integrations, generate a new internal integration and copy its secret. Share the relevant pages or databases with it in your workspace.",
  },
  {
    title: "Install the Notion MCP on TwinMCP",
    body: "Find Notion in the TwinMCP marketplace, click install, paste the integration secret. Provisioning takes under a minute.",
  },
  {
    title: "Connect your AI host",
    body: "Copy the URL and token from your dashboard into Cursor's mcp.json, Claude Desktop's config, or Claude Code via the CLI.",
  },
  {
    title: "Ask the model to search Notion",
    body: 'Triggers like "find my Q2 planning doc" or "summarize the onboarding page" make the model call the Notion MCP automatically.',
  },
];

const faq = [
  {
    q: "What can a Notion MCP actually do?",
    a: "Search pages by query, read the block content of a page, create new pages under a parent, append blocks to existing pages. The exact tool list depends on which Notion MCP you install — the official one and the curated one in the TwinMCP catalogue cover all of the above.",
  },
  {
    q: "Will the AI accidentally edit my Notion?",
    a: "Not without permission. Write-scope tools always trigger a confirmation in your AI host (Cursor, Claude Desktop), and the MCP itself can only touch pages your integration was shared with. The blast radius is bounded by Notion's own permissions.",
  },
  {
    q: "Do I need a paid Notion plan to use this?",
    a: "No. Notion's integration API is available on every plan, including the free one. TwinMCP's free tier covers running the Notion MCP for personal use.",
  },
  {
    q: "Can multiple teammates share the same hosted Notion MCP?",
    a: "The Team plan supports up to 10 members on shared servers; Pro is single-user; Free gives you one server slot total. Exact key-distribution semantics (one key per member vs shared) are documented in your dashboard.",
  },
  {
    q: "How do I keep my integration scoped to a single workspace database?",
    a: "Share only that one database with the Notion integration, leave everything else unshared. The integration cannot escalate beyond what was shared with it.",
  },
];

export default function NotionMcpPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="mb-20">
        <h2 className="text-3xl font-semibold tracking-tight">What the model gets access to</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          The Notion MCP exposes a small, focused set of tools to your AI agent. Each one maps
          cleanly to a Notion API endpoint, with a Zod-validated schema and explicit permission
          boundaries.
        </p>
        <ul className="mt-6 space-y-3 text-base text-muted-foreground">
          <li>
            <strong className="text-foreground">search_pages</strong> — full-text search across
            pages and databases the integration can see. Returns id, title, URL.
          </li>
          <li>
            <strong className="text-foreground">read_page</strong> — fetches the block content of a
            page by id. The model can quote, summarize, or rewrite it.
          </li>
          <li>
            <strong className="text-foreground">create_page</strong> — creates a page under a parent
            page or database with a title and optional content.
          </li>
          <li>
            <strong className="text-foreground">append_blocks</strong> — adds blocks to an existing
            page (paragraphs, headings, bullets).
          </li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Want to build a tailored version with custom database queries?{" "}
          <Link
            href={"/blog/notion-mcp-server-tutorial" as Route}
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Follow the Notion MCP server tutorial
          </Link>{" "}
          — it walks through the full TypeScript code, then shows how to deploy it back to TwinMCP.
        </p>
      </section>
    </UseCaseLayout>
  );
}
