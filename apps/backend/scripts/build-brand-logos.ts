// Builds src/components/brand/logos.generated.ts: the third-party brand marks
// the UI may show ("works with / connect to / in the catalogue" only; see
// docs/DESIGN.md "Logos and trademark rules").
//
// Source: simple-icons@16.35.0 (published 2026-10-11), pinned. The drawings are
// CC0-1.0 except Git (CC-BY-3.0, credit Jason Long). The trademarks remain the
// property of their owners. There is NO npm dependency and NO runtime/CI CDN
// call: this script is run by hand and its output file is committed.
//
// Usage (from apps/backend):
//   npx tsx scripts/build-brand-logos.ts             # fetch the pinned files from jsDelivr
//   npx tsx scripts/build-brand-logos.ts <local-dir> # read <dir>/data.json + <dir>/svg/<slug>.svg
//   npx prettier --write src/components/brand/logos.generated.ts
//
// <local-dir> is a folder holding a copy of the package's data/simple-icons.json
// (as data.json) and its icons/ folder (as svg/), e.g. a pre-downloaded copy.
//
// To add a logo: add a row to LOGOS below (key = an IdeKey from
// lib/mcp/client-config.ts or a catalogue slug from lib/servers/seed-catalog.ts),
// re-run the script, and keep src/__tests__/brand-logos.test.ts green. Never add
// a key from the deny-list in that test (Microsoft, Slack, NASA, Autodesk,
// Airbnb, YouTube, GitHub).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SI_VERSION = "16.35.0";
const CDN = `https://cdn.jsdelivr.net/npm/simple-icons@${SI_VERSION}`;
const OUT = fileURLToPath(new URL("../src/components/brand/logos.generated.ts", import.meta.url));

interface LogoSpec {
  /** Simple Icons slug. */
  si: string;
  /**
   * Fill colour. Omitted: the Simple Icons hex. `null`: render in currentColor
   * (black-only marks, marks whose brand forbids colour, and light marks that
   * vanish on white / light blue). A string: a brand-mandated override.
   */
  hex?: string | null;
  /** Display title override (the Simple Icons title otherwise). */
  title?: string;
  /** Attribution required by the drawing's licence. */
  credit?: string;
}

// Key → Simple Icons slug. Order = output order.
const LOGOS: Record<string, LogoSpec> = {
  // AI clients (IdeKey). No "vscode": Microsoft forbids the icon (text only).
  cursor: { si: "cursor", hex: null }, // black or white only
  "claude-desktop": { si: "claude" }, // Clay D97757, never recoloured
  "claude-code": { si: "claudecode" }, // Clay D97757, never recoloured
  windsurf: { si: "windsurf", hex: null }, // "Do not apply color to symbol"
  cline: { si: "cline", hex: null },
  zed: { si: "zedindustries", hex: "1348DC", title: "Zed" }, // zed.dev/brand blue
  other: { si: "modelcontextprotocol", hex: null }, // the MCP mark

  // Catalogue MCPs (seed-catalog.ts slug → Simple Icons slug).
  notion: { si: "notion", hex: null },
  linear: { si: "linear" },
  stripe: { si: "stripe" }, // blurple; Stripe allows slate, blurple or white
  sentry: { si: "sentry" },
  postgres: { si: "postgresql" },
  supabase: { si: "supabase" },
  mongodb: { si: "mongodb" },
  redis: { si: "redis" },
  figma: { si: "figma" },
  gitlab: { si: "gitlab" },
  hubspot: { si: "hubspot" },
  "brave-search": { si: "brave" },
  "google-maps": { si: "googlemaps" },
  airtable: { si: "airtable" },
  todoist: { si: "todoist" },
  perplexity: { si: "perplexity" },
  elasticsearch: { si: "elasticsearch" },
  neon: { si: "neon" },
  qdrant: { si: "qdrant" },
  elevenlabs: { si: "elevenlabs", hex: null },
  replicate: { si: "replicate", hex: null },
  clickhouse: { si: "clickhouse", hex: null }, // yellow vanishes on light grounds
  trello: { si: "trello" },
  "shopify-dev": { si: "shopify" },
  kubernetes: { si: "kubernetes" },
  reddit: { si: "reddit" },
  clickup: { si: "clickup" },
  discord: { si: "discord" },
  prometheus: { si: "prometheus" },
  kagi: { si: "kagi" },
  neo4j: { si: "neo4j" },
  milvus: { si: "milvus" },
  netlify: { si: "netlify" },
  digitalocean: { si: "digitalocean" },
  searxng: { si: "searxng" },
  git: {
    si: "git",
    credit:
      "Git Logo by Jason Long, licensed under CC BY 3.0 (https://git-scm.com/downloads/logos)",
  },
  sqlite: { si: "sqlite" },
  duckdb: { si: "duckdb", hex: null }, // yellow vanishes on light grounds
  duckduckgo: { si: "duckduckgo" },
  wikipedia: { si: "wikipedia", hex: null },
  arxiv: { si: "arxiv" },
  blender: { si: "blender" },
};

interface SiEntry {
  title: string;
  slug: string;
  hex: string;
  license?: { type: string };
}

const localDir = process.argv[2] ? resolve(process.argv[2]) : null;

async function loadData(): Promise<SiEntry[]> {
  if (localDir) return JSON.parse(await readFile(join(localDir, "data.json"), "utf8"));
  const res = await fetch(`${CDN}/data/simple-icons.json`);
  if (!res.ok) throw new Error(`simple-icons.json: HTTP ${res.status}`);
  return (await res.json()) as SiEntry[];
}

async function loadSvg(slug: string): Promise<string> {
  if (localDir) return readFile(join(localDir, "svg", `${slug}.svg`), "utf8");
  const res = await fetch(`${CDN}/icons/${slug}.svg`);
  if (!res.ok) throw new Error(`${slug}.svg: HTTP ${res.status}`);
  return res.text();
}

function extractPath(slug: string, svg: string): string {
  if (!/viewBox="0 0 24 24"/.test(svg)) throw new Error(`${slug}: unexpected viewBox`);
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length !== 1 || !paths[0].trim()) {
    throw new Error(`${slug}: expected exactly one <path d>, found ${paths.length}`);
  }
  return paths[0];
}

const HEX = /^[0-9A-F]{6}$/;

async function main() {
  const data = await loadData();
  const bySlug = new Map(data.map((e) => [e.slug, e]));
  const lines: string[] = [];

  for (const [key, spec] of Object.entries(LOGOS)) {
    const entry = bySlug.get(spec.si);
    if (!entry) throw new Error(`${key}: "${spec.si}" is not in simple-icons@${SI_VERSION}`);
    const license = entry.license?.type ?? "CC0-1.0";
    if (license !== "CC0-1.0" && !spec.credit) {
      throw new Error(`${key}: licence ${license} needs a credit line`);
    }
    const hex = spec.hex === undefined ? entry.hex.toUpperCase() : spec.hex;
    if (hex !== null && !HEX.test(hex)) throw new Error(`${key}: bad hex ${hex}`);
    const path = extractPath(spec.si, await loadSvg(spec.si));
    const fields = [
      `title: ${JSON.stringify(spec.title ?? entry.title)}`,
      `hex: ${hex === null ? "null" : JSON.stringify(hex)}`,
      `path: ${JSON.stringify(path)}`,
    ];
    if (spec.credit) fields.push(`credit: ${JSON.stringify(spec.credit)}`);
    lines.push(`  ${JSON.stringify(key)}: { ${fields.join(", ")} },`);
  }

  const out = `// GENERATED FILE: do not edit by hand. Re-run scripts/build-brand-logos.ts.
// simple-icons-version: ${SI_VERSION}
//
// Paths from Simple Icons (https://simpleicons.org), CC0-1.0, except Git
// (Git Logo by Jason Long, CC BY 3.0). All logos are trademarks of their
// respective owners; their use does not imply endorsement. Show them only in a
// "works with / connect to / available in the catalogue" sense, unmodified and
// never tinted with theme colours. hex === null renders in currentColor.

export interface BrandLogoDef {
  title: string;
  /** Brand fill without "#", or null to render in currentColor. */
  hex: string | null;
  /** Single SVG path in a 0 0 24 24 viewBox. */
  path: string;
  /** Attribution required by the drawing's licence. */
  credit?: string;
}

export const BRAND_LOGOS: Readonly<Record<string, BrandLogoDef>> = {
${lines.join("\n")}
};
`;
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, out, "utf8");
  console.log(`Wrote ${Object.keys(LOGOS).length} logos to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
