import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "production-mcp-servers";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: { canonical: `/blog/${SLUG}` },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${SLUG}`,
    publishedTime: post.publishedAt,
  },
};

export default function Post() {
  return (
    <PostLayout post={post}>
      <p>
        <strong>TL;DR.</strong> A curated list of MCP servers that survive contact with production:
        maintained, stable schemas, sensible defaults, and worth their place in your config. We
        dropped anything that has not seen a commit in six months or whose tools are too generic to
        actually help a model. Each entry includes the package name, what it does well, what it does
        not, and how to install it.
      </p>

      <h2 id="github">1. GitHub (official, maintained by GitHub)</h2>
      <p>
        Repo: <code>github/github-mcp-server</code> (a Go binary, not an npm package). The single
        most useful MCP for software work, now shipped by GitHub themselves &mdash; the original
        Anthropic-shipped <code>@modelcontextprotocol/server-github</code> has been deprecated in
        favor of this one. Lets the AI list repos, read code, browse pull requests, comment on
        issues, create branches, and inspect Actions runs.
      </p>
      <p>
        Authenticates with a fine-grained personal access token or a GitHub App. Scope it down
        (read-only contents + read-only pull requests) for daily use. What to watch: an unscoped
        token gives the model write access to everything you can touch &mdash; that includes
        accepting your own pull requests.
      </p>

      <h2 id="filesystem">2. Filesystem (official Anthropic server)</h2>
      <p>
        Package: <code>@modelcontextprotocol/server-filesystem</code>. Read and write files under a
        directory you whitelist at startup. The whitelist is enforced at the server boundary, not
        just the prompt &mdash; the model cannot escape the path you passed in <code>args</code>.
      </p>
      <p>
        Use it for project-local AI assistance (reviewing your own code, drafting docs, editing
        config). Keep the whitelisted directory tight. Never point it at <code>$HOME</code>.
      </p>

      <h2 id="postgres">3. Postgres (community-maintained)</h2>
      <p>
        Recommended: <code>crystaldba/postgres-mcp</code> or another actively-maintained community
        server. The Anthropic-original <code>@modelcontextprotocol/server-postgres</code> was
        archived in mid-2025 after a SQL-injection vulnerability disclosure; it is still
        downloadable but flagged unmaintained.
      </p>
      <p>
        What a Postgres MCP gives the model: schema introspection plus query execution. Use it on
        dev or staging databases. Point at production only with a strictly read-only role and a
        row-level security policy you trust.
      </p>

      <h2 id="slack">4. Slack (community-maintained)</h2>
      <p>
        The Anthropic-original <code>@modelcontextprotocol/server-slack</code> moved to the
        <code> servers-archived</code> repo and is no longer supported. Active community
        replacements exist (search npm for the most-starred Slack MCP at the time you install).
        Functionality is similar: search messages, list channels, post to channels the bot is
        invited to. Use a scoped Slack app bot token so rate limits stay predictable and audit logs
        name the bot.
      </p>
      <p>
        Common production use: a runbook agent that searches recent incident discussions before
        drafting a postmortem. Avoid the temptation to give it write access to sensitive channels.
      </p>

      <h2 id="notion">5. Notion</h2>
      <p>
        Notion now recommends their <strong>hosted remote MCP server</strong> for most users; the
        local <code>@notionhq/notion-mcp-server</code> npm package remains available but is being
        de-prioritized. Both expose the same primitives: search pages, read content, create pages,
        append blocks. Notion&apos;s API is verbose, so the server is correspondingly chatty &mdash;
        expect token usage to be higher than for narrower tools.
      </p>
      <p>
        For a walkthrough of building your own variant tuned to your workspace, see our{" "}
        <Link href={"/blog/notion-mcp-server-tutorial" as Route}>Notion MCP server tutorial</Link>.
      </p>

      <h2 id="linear">6. Linear (official hosted remote MCP)</h2>
      <p>
        Endpoint: <code>https://mcp.linear.app/mcp</code>. Linear ships an official hosted remote
        MCP server &mdash; you connect directly via HTTP transport rather than installing an npm
        package. Query issues, create issues, transition status, assign, comment. Schemas are kept
        in sync with Linear&apos;s GraphQL API by the same team that ships the API.
      </p>
      <p>
        Pair it with the GitHub server and the model can move issues to In Progress when a PR opens
        and to Done when it merges. Connect from Claude Code with{" "}
        <code>claude mcp add --transport http linear https://mcp.linear.app/mcp</code>.
      </p>

      <h2 id="puppeteer">7. Playwright (browser automation)</h2>
      <p>
        Recommended: <code>@playwright/mcp</code> from Microsoft. Gives the model a real headless
        Chromium / Firefox / WebKit it can navigate, screenshot, and scrape. The earlier
        <code> @modelcontextprotocol/server-puppeteer</code> has been archived in favor of the
        Playwright-based ecosystem &mdash; Playwright covers more browsers and ships richer
        accessibility-tree primitives that work well with model-driven automation.
      </p>
      <p>
        Useful for retrieving content REST APIs do not expose, for visual regression checks, and for
        filling forms during testing. Caveat: this is one of the most powerful and dangerous MCPs. A
        confused model can burn an arbitrary amount of compute. Run it in a managed runtime with CPU
        and wall-clock limits, not on your laptop.
      </p>

      <h2 id="fetch">8. Fetch (official Anthropic server)</h2>
      <p>
        Package: <code>@modelcontextprotocol/server-fetch</code>. The minimal HTTP client as an MCP
        tool: GET a URL, convert HTML to readable markdown, return it. Sounds trivial but it
        replaces a dozen of the smaller MCPs people otherwise install.
      </p>
      <p>
        Combine with Puppeteer for a clean &ldquo;read static page&rdquo; vs &ldquo;read JS-rendered
        page&rdquo; split &mdash; the model will choose the right tool.
      </p>

      <h2 id="memory">9. Memory</h2>
      <p>
        Package: <code>@modelcontextprotocol/server-memory</code>. A knowledge-graph memory store
        that the model writes to during conversations and reads back later. Survives across
        sessions. The simplest way to give an agent &ldquo;notice this and remember it next
        time&rdquo; behaviour without rolling your own retrieval stack.
      </p>
      <p>
        Worth scoping per-project rather than running it global &mdash; the memory graph gets noisy
        quickly when it mixes contexts.
      </p>

      <h2 id="time">10. Time and Sequential Thinking</h2>
      <p>
        Two small but high-impact servers in one entry, because both are official and both solve
        genuine model weaknesses. <code>@modelcontextprotocol/server-time</code> gives the model
        awareness of the current time and timezone arithmetic.{" "}
        <code>server-sequential-thinking</code> externalises a chain-of-thought buffer the model
        writes into when it needs to plan; downstream model calls can read it back.
      </p>
      <p>
        Neither is strictly necessary, both are cheap, and both noticeably reduce a class of
        small-but-annoying mistakes (wrong dates, half-thought-out plans).
      </p>

      <h2 id="installing">How to actually install these</h2>
      <p>
        Three paths. Stdio for local development (see the{" "}
        <Link href={"/blog/cursor-mcp-setup" as Route}>Cursor setup guide</Link> and the{" "}
        <Link href={"/blog/claude-desktop-mcp" as Route}>Claude Desktop setup guide</Link> for
        config snippets). Self-hosted Docker for team sharing. Managed runtime when you want the
        marketplace install to work in one click and your secrets to stay encrypted at rest.
      </p>
      <p>
        <Link href="/">TwinMCP&apos;s free tier</Link> includes a curated set of installable MCPs (5
        official servers including Filesystem, Fetch, Memory, Time, and Sequential Thinking).
        GitHub, Notion, Playwright, and additional connectors are available on Pro. Linear is
        connected directly via its hosted remote MCP &mdash; no install required on either tier.
      </p>
    </PostLayout>
  );
}
