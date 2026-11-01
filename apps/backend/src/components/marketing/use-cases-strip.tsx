import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BarChart3, Globe, Package, Search, type LucideIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { SOLUTIONS_INDEX_PATHS, solutionForBundle, solutionPath } from "@/lib/solutions/data";
import { Section } from "./section";

// What can run on TwinMCP, phrased as capabilities, never as customer claims.
// Each card links to the matching solution page (lib/solutions/data.ts, keyed
// by the MCP_BUNDLES id of lib/mcp-bundles.ts) or, when there is no page for
// it, to the catalogue / docs. The "Agent Toolkit" bundle is deliberately not
// featured: it contains `shell`, which waits for a first top-up.

type Card = { icon: LucideIcon; title: string; body: string; href: string; cta: string };

function href(bundleId: string, locale: Locale): string {
  const solution = solutionForBundle(bundleId);
  return solution ? solutionPath(solution, locale) : SOLUTIONS_INDEX_PATHS[locale];
}

function cards(locale: Locale): Card[] {
  if (locale === "fr") {
    return [
      {
        icon: Search,
        title: "Recherche",
        body: "Fetch, DuckDuckGo, Wikipedia et arXiv dans un seul serveur.",
        href: href("recherche", "fr"),
        cta: "Voir la solution",
      },
      {
        icon: BarChart3,
        title: "Données et graphiques",
        body: "Interrogez SQLite ou DuckDB et tracez le résultat depuis votre éditeur.",
        href: href("data", "fr"),
        cta: "Voir la solution",
      },
      {
        icon: Globe,
        title: "Web et médias",
        body: "Lisez pages, vidéos et documents comme contexte propre.",
        href: "/fr/serveurs",
        cta: "Voir le catalogue",
      },
      {
        icon: Package,
        title: "Votre propre serveur",
        body: "Publiez votre MCP npm ou PyPI après votre première recharge.",
        href: "/fr/docs",
        cta: "Lire la doc",
      },
    ];
  }
  return [
    {
      icon: Search,
      title: "Research",
      body: "Fetch, DuckDuckGo, Wikipedia and arXiv in one server.",
      href: href("recherche", "en"),
      cta: "See the solution",
    },
    {
      icon: BarChart3,
      title: "Data & charts",
      body: "Query SQLite or DuckDB and chart the result from your editor.",
      href: href("data", "en"),
      cta: "See the solution",
    },
    {
      icon: Globe,
      title: "Web & media",
      body: "Read pages, videos and documents as clean context.",
      href: "/servers",
      cta: "Browse the catalogue",
    },
    {
      icon: Package,
      title: "Your own server",
      body: "Publish your npm or PyPI MCP after your first top-up.",
      href: "/docs",
      cta: "Read the docs",
    },
  ];
}

const COPY: Record<Locale, { eyebrow: string; title: string }> = {
  en: { eyebrow: "Use cases", title: "What teams run on TwinMCP" },
  fr: { eyebrow: "Cas d’usage", title: "Ce que vous pouvez héberger" },
};

export function UseCasesStrip({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section
      id="use-cases"
      eyebrow={t.eyebrow}
      title={t.title}
      className="scroll-mt-20 bg-surface-alt py-16 md:py-24"
      containerClassName="px-4 sm:px-6"
    >
      <ul className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {cards(locale).map(({ icon: Icon, title, body, href: to, cta }) => (
          <li key={title}>
            <Link
              href={to as Route}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-6"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-brand">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="flex-1 text-sm text-muted-foreground">{body}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand group-hover:underline group-hover:underline-offset-4">
                {cta}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
