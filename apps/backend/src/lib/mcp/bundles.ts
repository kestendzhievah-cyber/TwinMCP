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

// ---------------------------------------------------------------------------
// Marketplace "Featured" order.
//
// A new account should see first what installs with no API key and works in a
// minute on a box, then the connectors that need a key, then the local-only
// tools that need `ctx7 connect` on the user's machine. FEATURED_ORDER pins the
// best first installs (every slug is a zero-config box entry of
// scripts/seed-mcps.ts); everything else falls into its tier and is ordered
// official-first, then by name. A slug missing from the catalog is ignored.
// ---------------------------------------------------------------------------

export const FEATURED_ORDER = [
  "fetch",
  "wikipedia",
  "memory",
  "duckduckgo",
  "sequential-thinking",
  "time",
  "calculator",
] as const;

/** The minimum a catalog entry needs to be sorted by {@link compareFeatured}. */
export interface FeaturedSortable {
  slug: string;
  name: string;
  isOfficial: boolean;
  hostMode: string;
  /** At least one required config field (an API key, a path, a URL…). */
  needsConfig: boolean;
}

const TIER_ZERO_CONFIG = 1_000;
const TIER_NEEDS_CONFIG = 2_000;
const TIER_LOCAL = 3_000;

/** Lower sorts first: pinned slugs, then zero-config, then configured, then local. */
export function featuredRank(entry: Pick<FeaturedSortable, "slug" | "hostMode" | "needsConfig">) {
  const pinned = (FEATURED_ORDER as readonly string[]).indexOf(entry.slug);
  if (pinned !== -1) return pinned;
  if (entry.hostMode === "local") return TIER_LOCAL;
  return entry.needsConfig ? TIER_NEEDS_CONFIG : TIER_ZERO_CONFIG;
}

/** Array.sort comparator for the marketplace's "Featured" order. */
export function compareFeatured(a: FeaturedSortable, b: FeaturedSortable): number {
  return (
    featuredRank(a) - featuredRank(b) ||
    Number(b.isOfficial) - Number(a.isOfficial) ||
    a.name.localeCompare(b.name)
  );
}

type SchemaProps = Record<string, { required?: unknown; secret?: unknown } | null | undefined>;

function schemaProps(schema: unknown): SchemaProps {
  if (!schema || typeof schema !== "object" || !("properties" in schema)) return {};
  const props = (schema as { properties?: unknown }).properties;
  return props && typeof props === "object" ? (props as SchemaProps) : {};
}

/** True when the MCP's configSchema has at least one required field. */
export function configNeedsSetup(schema: unknown): boolean {
  return Object.values(schemaProps(schema)).some((p) => p?.required === true);
}

// Field names that carry a credential even when the seed forgot `secret`.
const CREDENTIAL_NAME_RE = /token|key|secret|password|credential/i;

/**
 * True when installing the MCP requires a credential: a required config field
 * flagged `secret`, or named like a token / key / password. Drives the
 * marketplace's "needs API key" badge.
 */
export function configNeedsKey(schema: unknown): boolean {
  return Object.entries(schemaProps(schema)).some(
    ([name, p]) => p?.required === true && (p.secret === true || CREDENTIAL_NAME_RE.test(name))
  );
}
