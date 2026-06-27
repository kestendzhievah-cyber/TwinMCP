// Locale definitions for hreflang alternates and language switcher.
// Phase 5 is additive — we have an English site at `/` and a French
// shadow at `/fr`. Dashboards and auth remain English-only by design.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export type Locale = "en" | "fr";

export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

// Returns the URL prefix for a locale ("" for default English).
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "" : `/${locale}`;
}

// Builds an absolute URL for a path in a given locale.
export function localizedUrl(locale: Locale, path: string): string {
  const prefix = localePrefix(locale);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${prefix}${normalized === "/" ? "" : normalized}` || `${SITE_URL}/`;
}

// Builds the alternates.languages map for Next.js Metadata.
// Pass the path WITHOUT locale prefix (e.g. "/" or "/blog/what-is-mcp")
// and which locales the page is actually available in.
export function hreflangAlternates(
  path: string,
  availableLocales: Locale[] = LOCALES
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const loc of availableLocales) {
    map[loc] = `${localePrefix(loc)}${path === "/" ? "" : path}` || "/";
  }
  // x-default points to the canonical (English) variant
  if (availableLocales.includes(DEFAULT_LOCALE)) {
    map["x-default"] = `${path === "/" ? "" : path}` || "/";
  }
  return map;
}
