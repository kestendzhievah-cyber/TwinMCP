// Curated packs of catalog MCPs an admin can deploy onto a client's server in
// one click ("adapter les serveurs MCP pour eux"). Pure data — imported by both
// the bundle-install API route and the admin UI, so no server-only deps here.
//
// Slugs must match seed-mcps.ts. The install endpoint is defensive: any slug
// that is missing, non-public, host-mode "local", already installed, over the
// box capacity, or that requires per-user config (e.g. an API key) is skipped
// with a reason — so a bundle never half-fails. Packs favour zero-config tools
// so they work out of the box; ones needing a key are installed individually.

export interface McpBundle {
  id: string;
  label: string;
  description: string;
  slugs: string[];
}

export const MCP_BUNDLES: McpBundle[] = [
  {
    id: "essentiel",
    label: "Essentiel",
    description: "Recherche web, heure, mémoire, raisonnement — prêt à l'emploi.",
    slugs: ["fetch", "time", "sequential-thinking", "memory"],
  },
  {
    id: "dev",
    label: "Développeur",
    description: "Git, système de fichiers et base SQLite locale.",
    slugs: ["git", "filesystem", "sqlite"],
  },
  {
    id: "recherche",
    label: "Recherche",
    description: "DuckDuckGo, Wikipédia et arXiv.",
    slugs: ["duckduckgo", "wikipedia", "arxiv"],
  },
  {
    id: "data",
    label: "Data",
    description: "DuckDB en local + Postgres (clé de connexion à renseigner ensuite).",
    slugs: ["duckdb", "postgres"],
  },
  {
    id: "finance",
    label: "Finance",
    description: "Yahoo Finance, CoinGecko et calculatrice.",
    slugs: ["yahoo-finance", "coingecko", "calculator"],
  },
];

export function getBundle(id: string): McpBundle | undefined {
  return MCP_BUNDLES.find((b) => b.id === id);
}
