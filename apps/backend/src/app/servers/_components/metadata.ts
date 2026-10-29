import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/locales";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

/** Page metadata for the catalogue pages: absolute title (already ≤ 60 chars,
 *  brand included), canonical, hreflang alternates and Open Graph. */
export function catalogueMetadata(opts: {
  title: string;
  description: string;
  path: string;
  languages: Record<string, string>;
  locale: Locale;
  type?: "website" | "article";
  /** false → `noindex, follow` (long-tail client guides, lib/seo/server-pages.ts). */
  indexable?: boolean;
}): Metadata {
  return {
    title: { absolute: opts.title },
    ...(opts.indexable === false ? { robots: { index: false, follow: true } } : {}),
    description: opts.description,
    alternates: { canonical: opts.path, languages: opts.languages },
    openGraph: {
      type: opts.type ?? "article",
      siteName: "TwinMCP",
      url: `${SITE_URL}${opts.path}`,
      title: opts.title,
      description: opts.description,
      locale: opts.locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description },
  };
}
