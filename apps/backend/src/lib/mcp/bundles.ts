// Curated 1-click MCP bundles for the marketplace. Every slug here MUST be a
// zero-config (or default-config) official MCP so a bundle installs in a single
// click with no prompts. Config-required MCPs (filesystem, git) are deliberately
// excluded. The UI filters each bundle down to the slugs actually in the catalog.
//
// Keep this pure/client-safe (no server-only imports) — it's rendered client-side.

export interface McpBundle {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  slugs: string[];
}

export const BUNDLES: McpBundle[] = [
  {
    id: "research",
    name: "Research",
    tagline: "Search the web, Wikipedia, and arXiv — and read any page.",
    emoji: "🔎",
    slugs: ["fetch", "duckduckgo", "wikipedia", "arxiv"],
  },
  {
    id: "data",
    name: "Data & Viz",
    tagline: "Query databases, crunch CSV/Parquet, and render charts.",
    emoji: "📊",
    slugs: ["sqlite", "duckdb", "chart", "markitdown"],
  },
  {
    id: "agent",
    name: "Agent Toolkit",
    tagline: "Run commands, keep memory, reason step by step, do exact math.",
    emoji: "🛠️",
    slugs: ["shell", "memory", "sequential-thinking", "calculator"],
  },
  {
    id: "media",
    name: "Web & Media",
    tagline: "Fetch pages, search the web, and pull YouTube transcripts.",
    emoji: "🎬",
    slugs: ["fetch", "duckduckgo", "youtube", "markitdown"],
  },
];
