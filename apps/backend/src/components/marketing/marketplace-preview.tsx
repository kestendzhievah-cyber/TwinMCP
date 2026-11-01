import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { Locale } from "@/lib/i18n/locales";
import { SERVERS, getServerBySlug } from "@/lib/servers/catalog";
import { Section } from "./section";

// A logo grid of well-known catalogue MCPs. Read from the public catalogue
// (lib/servers/catalog.ts, built from the seed: retired and internal slugs are
// already out), so a slug that leaves the catalogue drops from the grid and the
// "+N more" tile follows the real count (catalogue size − logos shown). No
// database read on the home page. Brave Search is the spare: it fills the grid
// if an earlier slug ever leaves the catalogue.
const FEATURED = [
  "notion",
  "linear",
  "stripe",
  "sentry",
  "postgres",
  "supabase",
  "mongodb",
  "redis",
  "figma",
  "gitlab",
  "hubspot",
  "brave-search",
] as const;

/** Grid cells, the "+N more" tile included. */
const TILES = 12;

const COPY = {
  en: {
    eyebrow: "Catalogue",
    title: "70+ MCPs, ready to run",
    description:
      "Databases, docs, project tools, search and more. Add one to your server in a click.",
    more: (n: number) => `+${n} more`,
    moreLabel: (n: number) => `Browse the full catalogue (${n} more MCPs)`,
    base: "/servers",
  },
  fr: {
    eyebrow: "Catalogue",
    title: "Plus de 70 MCP prêts à l’emploi",
    description:
      "Bases de données, docs, outils projet, recherche… Ajoutez-en un à votre serveur en un clic.",
    more: (n: number) => `+${n} autres`,
    moreLabel: (n: number) => `Voir tout le catalogue (${n} autres MCP)`,
    base: "/fr/serveurs",
  },
} as const;

const TILE =
  "flex h-full min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border p-4 text-center transition hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function MarketplacePreview({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  // One tile is the "+N more" link, so the grid shows TILES − 1 logos: twelve
  // cells fill rows of 3, 4 and 6 exactly.
  const shown = FEATURED.map((slug) => getServerBySlug(slug))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .slice(0, TILES - 1);
  const more = Math.max(0, SERVERS.length - shown.length);

  return (
    <Section
      id="marketplace"
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      className="scroll-mt-20 bg-background py-16 md:py-24"
      containerClassName="px-4 sm:px-6"
    >
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-6">
        {shown.map((s) => (
          <li key={s.slug}>
            <Link href={`${t.base}/${s.slug}` as Route} className={`${TILE} bg-card`}>
              <BrandLogo slug={s.slug} size={32} decorative />
              {/* text-xs on phones: a 10-letter name (PostgreSQL) fits a third of
                  a 375px row without breaking mid-word. */}
              <span className="w-full break-words text-xs font-medium leading-tight text-foreground sm:text-sm">
                {s.name}
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={t.base as Route}
            data-cta-location="marketplace_catalog"
            aria-label={t.moreLabel(more)}
            className={`${TILE} bg-secondary`}
          >
            <span className="font-display text-xl font-bold tracking-tight text-foreground tabular-nums">
              {t.more(more)}
            </span>
            <ArrowRight aria-hidden className="h-4 w-4 text-brand" />
          </Link>
        </li>
      </ul>
    </Section>
  );
}
