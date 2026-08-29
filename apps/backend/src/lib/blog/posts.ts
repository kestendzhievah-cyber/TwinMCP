// Central blog registry. Add new posts here AND create the matching page at
// app/blog/<slug>/page.tsx. The registry powers:
//   - /blog index page
//   - sitemap.ts entries
//   - /blog/feed.xml RSS feed
//   - related posts / breadcrumbs

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  updatedAt?: string; // ISO date
  readingTimeMinutes: number;
  tags: string[];
  ogImage?: string; // optional override (defaults to dynamic OG)
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-is-mcp",
    title: "What is Model Context Protocol? The complete 2026 guide",
    description:
      "MCP explained from scratch — what it is, why Anthropic built it, how clients and servers talk, and what you can do with it today. The reference guide for 2026.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 14,
    tags: ["mcp", "anthropic", "ai-agents", "fundamentals"],
  },
  {
    slug: "mcp-server-hosting",
    title: "MCP server hosting in 2026: self-host vs managed compared",
    description:
      "Where should your Model Context Protocol servers actually run? Compare local stdio, Docker on a VPS, Cloudflare Workers, Smithery, and managed runtimes like TwinMCP — with real numbers.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 16,
    tags: ["mcp", "hosting", "deployment", "comparison"],
  },
  {
    slug: "build-mcp-server",
    title: "How to build a Model Context Protocol server (step-by-step)",
    description:
      "Build a working MCP server from zero in TypeScript: tools, resources, prompts, transport, deploy, and connect it to Cursor and Claude Code. Full code, no shortcuts.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 18,
    tags: ["mcp", "tutorial", "typescript", "sdk"],
  },
  {
    slug: "cursor-mcp-setup",
    title: "Cursor MCP setup: connect any tool in 5 minutes",
    description:
      "Add Model Context Protocol servers to Cursor without the friction. Config file location, stdio vs HTTP, every common error, and the right way to keep secrets out of the repo.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 8,
    tags: ["cursor", "mcp", "setup", "ide"],
  },
  {
    slug: "claude-desktop-mcp",
    title: "Claude Desktop MCP servers: the full installation guide",
    description:
      "Connect MCP servers to Claude Desktop on macOS, Windows, and Linux. Config file path, JSON schema, environment variables, and what differs from Cursor and Claude Code.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 8,
    tags: ["claude-desktop", "mcp", "setup"],
  },
  {
    slug: "mcp-vs-langchain",
    title: "MCP vs LangChain Tools: which one to choose in 2026",
    description:
      "MCP and LangChain solve overlapping problems but at different layers. A direct comparison with decision criteria, when each wins, and how to combine them.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 9,
    tags: ["mcp", "langchain", "comparison"],
  },
  {
    slug: "production-mcp-servers",
    title: "10 production-ready MCP servers worth installing (2026)",
    description:
      "Curated list of MCP servers that are stable, maintained, and earn their keep in real workflows. GitHub, Postgres, Slack, Notion, browser automation, and more.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 9,
    tags: ["mcp", "marketplace", "curated"],
  },
  {
    slug: "secure-mcp-server",
    title: "Securing your MCP server: auth, rate-limits, secrets",
    description:
      "An MCP server gives an AI model write access to real systems. Bearer tokens, OAuth flows, rate limits, secret management, network egress policy, and prompt injection defenses.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 10,
    tags: ["mcp", "security", "auth"],
  },
  {
    slug: "upstash-box-vs-cloudflare-workers",
    title: "Deploy MCP servers: Upstash Box vs Cloudflare Workers",
    description:
      "Two of the cleanest serverless options for hosting MCP servers, compared on real criteria — cold start, long-lived SSE, regional latency, pricing at production scale.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 9,
    tags: ["mcp", "hosting", "upstash", "cloudflare"],
  },
  {
    slug: "smithery-vs-twinmcp",
    title: "MCP catalog comparison: Smithery vs TwinMCP vs self-host",
    description:
      "Smithery, TwinMCP, and self-hosting cover three very different use cases. Decision matrix with cost, isolation, private code, secrets, and team-sharing.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 9,
    tags: ["mcp", "smithery", "twinmcp", "comparison"],
  },
  {
    slug: "notion-mcp-server-tutorial",
    title: "Build a Notion MCP server with TypeScript (tutorial)",
    description:
      "Step-by-step build of a Notion MCP server: search pages, read content, create pages, all wired into Cursor and Claude Code. Full TypeScript code, real Notion API.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 11,
    tags: ["mcp", "notion", "tutorial", "typescript"],
  },
  {
    slug: "mcp-server-monitoring",
    title: "MCP server monitoring: logs, metrics, and error tracking",
    description:
      "What to log from an MCP server, which metrics matter, how to ship them to Datadog, Grafana, or Axiom, and how to catch the failures the AI client silently hides from you.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 9,
    tags: ["mcp", "observability", "monitoring"],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

// Look up posts by an explicit, ordered list of slugs (skips unknowns). Powers
// the "Related reading" block on use-case pages.
export function getPostsBySlugs(slugs: string[]): BlogPost[] {
  return slugs
    .map((slug) => BLOG_POSTS.find((p) => p.slug === slug))
    .filter((p): p is BlogPost => Boolean(p));
}

export function getSortedPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getRelatedPosts(currentSlug: string, limit = 2): BlogPost[] {
  return getSortedPosts()
    .filter((p) => p.slug !== currentSlug)
    .slice(0, limit);
}
