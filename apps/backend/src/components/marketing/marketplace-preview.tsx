import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, Package } from "lucide-react";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Locale } from "@/lib/i18n/locales";
import { Section } from "./section";

export const revalidate = 3600;

// The preview is a promise ("installs in one click"), so it lists only MCPs
// that keep it: box-hosted, no required config field, not retired — checked
// against scripts/seed-mcps.ts. Most-recent-first used to surface local-only
// tools (Revit, Blender) and connectors that need third-party keys.
const CURATED_SLUGS = [
  "fetch",
  "duckduckgo",
  "wikipedia",
  "memory",
  "sequential-thinking",
  "time",
] as const;

type CatalogPreviewItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
};

type ConfigSchema = { properties?: Record<string, { required?: boolean }> };

function needsConfig(schema: unknown): boolean {
  const props = (schema as ConfigSchema | null)?.properties ?? {};
  return Object.values(props).some((p) => p?.required === true);
}

async function fetchOfficialPreview(): Promise<CatalogPreviewItem[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: mcpServers.id,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
        hostMode: mcpServers.hostMode,
        configSchema: mcpServers.configSchema,
      })
      .from(mcpServers)
      .where(
        and(
          eq(mcpServers.isOfficial, true),
          eq(mcpServers.isPublic, true),
          inArray(mcpServers.slug, [...CURATED_SLUGS])
        )
      );
    // Re-check the promise against live data (a slug could later gain a
    // required key or move to local hosting), then keep the curated order.
    const order = new Map<string, number>(CURATED_SLUGS.map((slug, i) => [slug, i]));
    return rows
      .filter((r) => r.hostMode === "box" && !needsConfig(r.configSchema))
      .sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99))
      .map(({ id, slug, name, description }) => ({ id, slug, name, description }));
  } catch {
    return [];
  }
}

// Static fallback (catalog unreachable at build time, or not seeded yet): the
// same curated slugs, names and descriptions as scripts/seed-mcps.ts.
const FALLBACK: CatalogPreviewItem[] = [
  {
    id: "preview-fetch",
    slug: "fetch",
    name: "Fetch",
    description: "Fetch a URL and return its content as markdown (official MCP fetch server).",
  },
  {
    id: "preview-duckduckgo",
    slug: "duckduckgo",
    name: "DuckDuckGo Search",
    description:
      "Search the web via DuckDuckGo and fetch page content as clean text. No API key — works out of the box.",
  },
  {
    id: "preview-wikipedia",
    slug: "wikipedia",
    name: "Wikipedia",
    description:
      "Search Wikipedia and pull article summaries, sections, and links for grounded facts. No API key required.",
  },
  {
    id: "preview-memory",
    slug: "memory",
    name: "Memory",
    description: "Persistent knowledge-graph memory the model can read and write across turns.",
  },
  {
    id: "preview-sequential-thinking",
    slug: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Structured step-by-step reasoning tool for breaking down complex problems.",
  },
  {
    id: "preview-time",
    slug: "time",
    name: "Time",
    description:
      "Current time and timezone conversion. Ask for the time anywhere or convert between IANA timezones.",
  },
];

// Catalog descriptions are stored in English; the French home shows these.
const DESCRIPTIONS_FR: Record<string, string> = {
  fetch: "Récupère une page web et renvoie son contenu en Markdown (serveur fetch officiel MCP).",
  duckduckgo:
    "Recherche sur le web via DuckDuckGo et renvoie le contenu des pages en texte propre. Sans clé API.",
  wikipedia:
    "Recherche dans Wikipédia : résumés d’articles, sections et liens pour des faits sourcés. Sans clé API.",
  memory: "Une mémoire persistante en graphe de connaissances, que le modèle lit et enrichit.",
  "sequential-thinking":
    "Un outil de raisonnement pas à pas pour décomposer les problèmes complexes.",
  time: "Heure actuelle et conversion de fuseaux horaires IANA, partout dans le monde.",
};

const COPY = {
  en: {
    eyebrow: "Marketplace",
    title: "Zero-config MCPs, installed in one click",
    description:
      "No API key, no config file: these run as soon as you add them. The catalog lists 70+ MCPs, including connectors for Notion, Linear, Postgres and Slack.",
    package: "Package",
    slug: "Slug",
    setup: "Setup",
    none: "None",
    official: "official",
    browse: "Browse the 70+ MCPs",
  },
  fr: {
    eyebrow: "Catalogue",
    title: "Des MCP sans configuration, installés en un clic",
    description:
      "Ni clé API ni fichier de configuration : ils tournent dès que vous les ajoutez. Le catalogue compte plus de 70 MCP, dont des connecteurs Notion, Linear, Postgres et Slack.",
    package: "MCP",
    slug: "Slug",
    setup: "Configuration",
    none: "Aucune",
    official: "officiel",
    browse: "Voir les 70+ MCP du catalogue",
  },
} as const;

export async function MarketplacePreview({ locale = "en" }: { locale?: Locale }) {
  const items = await fetchOfficialPreview();
  const t = COPY[locale];

  // Graceful fallback: pre-launch, or with the catalog unreachable, we still
  // want the section, so render the curated items as a teaser.
  const display: CatalogPreviewItem[] = items.length > 0 ? items : FALLBACK;

  return (
    <Section
      id="marketplace"
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      className="scroll-mt-20"
    >
      {/* The catalogue is a ledger: one line per package, slug in typewriter. */}
      <div className="border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t.package}</TableHead>
              <TableHead className="hidden md:table-cell">{t.slug}</TableHead>
              <TableHead className="pr-5 text-right">{t.setup}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.map((mcp) => (
              <TableRow key={mcp.id}>
                <TableCell className="py-4 pl-5 align-top">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="smallcaps tracking-sc text-base font-medium leading-5">
                          {mcp.name}
                        </h3>
                        <Badge variant="outline">{t.official}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 max-w-md text-sm text-muted-foreground">
                        {locale === "fr"
                          ? (DESCRIPTIONS_FR[mcp.slug] ?? mcp.description)
                          : mcp.description}
                      </p>
                      <code className="mt-1 block font-mono text-xs text-muted-foreground md:hidden">
                        {mcp.slug}
                      </code>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden py-4 align-top md:table-cell">
                  <code className="font-mono text-xs text-muted-foreground">{mcp.slug}</code>
                </TableCell>
                <TableCell className="py-4 pr-5 text-right align-top">
                  <span className="smallcaps tracking-sc inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-4 w-4 text-success" aria-hidden />
                    {t.none}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link
            href={(locale === "fr" ? "/fr/serveurs" : "/servers") as Route}
            data-cta-location="marketplace_catalog"
          >
            {t.browse}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
