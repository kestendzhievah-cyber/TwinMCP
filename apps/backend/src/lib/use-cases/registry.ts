// Use-case landing pages. Each one targets a specific high-intent search
// query and converts visitors to free-tier sign-ups. The registry powers the
// /use-cases index, sitemap entries, and breadcrumb navigation.

export interface UseCase {
  slug: string;
  title: string; // exact-match keyword in the H1
  metaTitle: string; // SEO title (with brand suffix)
  description: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroSubheadline: string;
  targetKeyword: string;
  relatedServerSlugs: string[]; // /servers/<slug> catalog pages to cross-link
  relatedBlogSlugs: string[]; // /blog/<slug> posts to cross-link
}

export const USE_CASES: UseCase[] = [
  {
    slug: "cursor-mcp-hosting",
    title: "Cursor MCP hosting",
    metaTitle: "Cursor MCP hosting — run MCP servers for Cursor in 2 minutes",
    description:
      "Host MCP servers for Cursor without managing infrastructure. Isolated runtimes, per-user API keys, marketplace access, and a config snippet that pastes straight into Cursor.",
    heroEyebrow: "For Cursor users",
    heroHeadline: "Cursor MCP hosting that just works",
    heroSubheadline:
      "Provision isolated MCP servers, install MCPs from the marketplace, and connect Cursor in two minutes. Free tier — no credit card.",
    targetKeyword: "Cursor MCP hosting",
    relatedServerSlugs: ["filesystem", "memory", "fetch"],
    relatedBlogSlugs: ["cursor-mcp-setup", "production-mcp-servers"],
  },
  {
    slug: "claude-mcp-hosting",
    title: "Claude MCP hosting",
    metaTitle: "Claude Desktop & Claude Code MCP hosting — TwinMCP",
    description:
      "Host MCP servers for Claude Desktop and Claude Code. One URL, one token, isolated runtime per server, marketplace MCPs in one click.",
    heroEyebrow: "For Claude users",
    heroHeadline: "Claude MCP hosting in two minutes",
    heroSubheadline:
      "Spin up MCP servers for Claude Desktop or Claude Code without operating containers. Per-server sandboxes, encrypted secrets, ready-to-paste config.",
    targetKeyword: "Claude MCP hosting",
    relatedServerSlugs: ["filesystem", "memory", "sequential-thinking"],
    relatedBlogSlugs: ["claude-desktop-mcp", "mcp-server-hosting"],
  },
  {
    slug: "notion-mcp",
    title: "Notion MCP",
    metaTitle: "Notion MCP — connect your Notion workspace to AI agents",
    description:
      "Run a Notion MCP server in a managed runtime. Search pages, read content, create pages from Cursor, Claude Desktop, Windsurf, or Cline — no laptop process, no local secrets.",
    heroEyebrow: "Notion connector",
    heroHeadline: "Notion MCP, hosted",
    heroSubheadline:
      "Give your AI coding agent access to your Notion workspace through MCP. One install, one stable URL, secrets encrypted at rest.",
    targetKeyword: "Notion MCP",
    relatedServerSlugs: ["notion", "fetch"],
    relatedBlogSlugs: ["notion-mcp-server-tutorial", "mcp-server-hosting"],
  },
  {
    // TwinMCP does NOT host GitHub's official MCP server (Go binary / Docker
    // image, retired in scripts/seed-mcps.ts). The copy says what works today.
    slug: "github-mcp",
    title: "GitHub MCP",
    metaTitle: "GitHub MCP: what works today, and how to bring your own — TwinMCP",
    description:
      "TwinMCP does not host GitHub's official MCP server. Here is what works today: GitHub's own remote MCP server, your own npm or PyPI GitHub MCP published on TwinMCP Pro, and the GitLab and Git MCPs from the catalogue.",
    heroEyebrow: "GitHub connector",
    heroHeadline: "GitHub MCP: what works today",
    heroSubheadline:
      "TwinMCP does not host GitHub's official MCP server. You can still give your AI agent GitHub context: connect GitHub's own remote server, or bring a Node or Python GitHub MCP and run it on your TwinMCP server.",
    targetKeyword: "GitHub MCP",
    relatedServerSlugs: ["sentry", "linear"],
    relatedBlogSlugs: ["secure-mcp-server", "production-mcp-servers"],
  },
];

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}
