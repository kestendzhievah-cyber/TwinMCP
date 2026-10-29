import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { USE_CASES } from "@/lib/use-cases/registry";
import { SERVERS_PATHS } from "@/lib/i18n/locales";
import {
  clientPath,
  indexedClientPageParams,
  serverPageParams,
  serverPath,
} from "@/lib/seo/server-pages";
import { latestChangelogDate } from "@/lib/marketing/changelog";
import { compareTwinPairs } from "@/lib/compare/data";
import { SOLUTIONS, SOLUTIONS_INDEX_PATHS, solutionPath } from "@/lib/solutions/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

// A real date, not `new Date()`: a lastModified that changes on every build
// tells crawlers every page changed every deploy, so they learn to ignore it.
// Bump it when the static/marketing pages change materially.
const CONTENT_UPDATED = new Date("2026-10-27T00:00:00Z");

// The changelog changes when an entry is added: its newest entry's date.
const CHANGELOG_UPDATED = new Date(`${latestChangelogDate()}T00:00:00Z`);

// The Smithery migration landings get top priority while Smithery's shutdown
// (31 October 2026, smithery.ai/future) is driving searches. Drop to 0.7 in 2027.
const SMITHERY_WINDOW_PRIORITY = 0.9;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/plans`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/migrate-from-smithery`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: SMITHERY_WINDOW_PRIORITY,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/use-cases`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/servers`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/docs/api-reference`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/security`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/changelog`,
      lastModified: CHANGELOG_UPDATED,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/sign-up`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/fr/inscription`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/mentions-legales`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/en/privacy`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/en/terms`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/en/notice`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const blogPosts: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt ?? p.publishedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const useCases: MetadataRoute.Sitemap = USE_CASES.map((u) => ({
    url: `${SITE_URL}/use-cases/${u.slug}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  // MCP catalogue (app/servers, app/fr/serveurs): one page per installable MCP
  // in both languages; per-client guides only for the indexed MCPs
  // (INDEXED_CLIENT_GUIDE_SLUGS: the others are noindex, follow). Same param
  // builders as the pages' generateStaticParams, so the sitemap cannot list a
  // page that 404s.
  const serverPages: MetadataRoute.Sitemap = serverPageParams().flatMap(({ slug }) =>
    (["en", "fr"] as const).map((locale) => ({
      url: `${SITE_URL}${serverPath(slug, locale)}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }))
  );

  const serverClientPages: MetadataRoute.Sitemap = (["en", "fr"] as const).flatMap((locale) =>
    indexedClientPageParams(locale).map(({ slug, client }) => ({
      url: `${SITE_URL}${clientPath(slug, client, locale)}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    }))
  );

  // Bilingual sections whose FR slugs differ from the EN ones: list both
  // pages of each pair with symmetric hreflang alternates (x-default = EN).
  // Built from the same helpers as the pages, so the sitemap cannot drift.
  const twin = (pair: { en: string; fr: string }, priority: number): MetadataRoute.Sitemap => {
    const languages = {
      en: `${SITE_URL}${pair.en}`,
      fr: `${SITE_URL}${pair.fr}`,
      "x-default": `${SITE_URL}${pair.en}`,
    };
    return [pair.en, pair.fr].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority,
      alternates: { languages },
    }));
  };

  // Comparison hub (app/compare, app/fr/comparer): hub first, then each page.
  const comparePages: MetadataRoute.Sitemap = compareTwinPairs().flatMap((pair, i) =>
    twin(pair, i === 0 ? 0.8 : 0.75)
  );

  // Segment pages (app/solutions, app/fr/solutions): index, then one per pack.
  const solutionPages: MetadataRoute.Sitemap = [
    ...twin(SOLUTIONS_INDEX_PATHS, 0.8),
    ...SOLUTIONS.flatMap((s) =>
      twin({ en: solutionPath(s, "en"), fr: solutionPath(s, "fr") }, 0.75)
    ),
  ];

  // French pages (Phase 5 — additive shadow of EN marketing + 3 pillars).
  const FR_PILLARS = [
    "what-is-mcp",
    "mcp-server-hosting",
    "build-mcp-server",
    "smithery-alternatives",
    "managed-vs-self-hosted-mcp",
  ];
  const frPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/fr`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/fr/migrer-depuis-smithery`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: SMITHERY_WINDOW_PRIORITY,
    },
    {
      url: `${SITE_URL}${SERVERS_PATHS.fr}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/fr/tarifs`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/fr/demo`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/fr/securite`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/fr/changelog`,
      lastModified: CHANGELOG_UPDATED,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/fr/blog`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/fr/docs`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...FR_PILLARS.map((slug) => ({
      url: `${SITE_URL}/fr/blog/${slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return [
    ...staticPages,
    ...blogPosts,
    ...useCases,
    ...serverPages,
    ...serverClientPages,
    ...frPages,
    ...comparePages,
    ...solutionPages,
  ];
}
