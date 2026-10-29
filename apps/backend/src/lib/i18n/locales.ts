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

// Marketing paths (WITHOUT the /fr prefix) that actually have a French page.
// The language switcher only flips the /fr prefix, so offering "FR" on a path
// with no French twin dead-ends in a 404 — this is the allow-list that prevents
// that. Keep in sync with the pages under `app/fr/`.
const FR_AVAILABLE_EXACT = new Set<string>([
  "/",
  "/docs",
  "/blog",
  "/blog/what-is-mcp",
  "/blog/build-mcp-server",
  "/blog/mcp-server-hosting",
  "/blog/smithery-alternatives",
  "/blog/managed-vs-self-hosted-mcp",
  // Guided setup: same slug in both languages (app/fr/demo).
  "/demo",
  // Changelog: same slug in both languages (app/fr/changelog).
  "/changelog",
  // Segment pages (app/fr/solutions; lib/solutions/data.ts): the index and the
  // packs whose slug is the same in both languages. Translated slugs are in
  // TRANSLATED_TWINS below.
  "/solutions",
  "/solutions/data",
  "/solutions/finance",
]);

// True when the locale-agnostic path has a French translation available.
export function hasFrenchVersion(path: string): boolean {
  const clean = path.replace(/\/+$/, "") || "/";
  if (FR_AVAILABLE_EXACT.has(clean)) return true;
  // Creator landing pages are localized (`fr/p/[slug]`).
  if (clean.startsWith("/p/")) return true;
  return false;
}

// Pages whose French twin lives at a TRANSLATED slug rather than at `/fr` +
// the English path. Flipping the prefix cannot reach them (/fr/plans would
// 404), so they are deliberately absent from FR_AVAILABLE_EXACT — the
// prefix-flipping switcher hides itself there. Use `localizedPath()` to link
// between the two versions. Keep in sync with the `alternates.languages` of
// each page and with app/sitemap.ts.
export const TRANSLATED_TWINS: ReadonlyArray<{ en: string; fr: string }> = [
  { en: "/plans", fr: "/fr/tarifs" },
  { en: "/sign-up", fr: "/fr/inscription" },
  { en: "/migrate-from-smithery", fr: "/fr/migrer-depuis-smithery" },
  { en: "/security", fr: "/fr/securite" },
  // Auth screens (app/(auth-fr)/fr/…; lib/i18n/auth-paths.ts). Not indexed.
  { en: "/sign-in", fr: "/fr/connexion" },
  { en: "/forgot-password", fr: "/fr/mot-de-passe-oublie" },
  { en: "/reset-password", fr: "/fr/nouveau-mot-de-passe" },
  // Segment pages with translated slugs (lib/solutions/data.ts).
  { en: "/solutions/essentials", fr: "/fr/solutions/essentiel" },
  { en: "/solutions/developers", fr: "/fr/solutions/developpeurs" },
  { en: "/solutions/research", fr: "/fr/solutions/recherche" },
  // Comparisons (app/compare, app/fr/comparer; lib/compare/data.ts compareTwinPairs()).
  { en: "/compare", fr: "/fr/comparer" },
  { en: "/compare/composio", fr: "/fr/comparer/composio" },
  { en: "/compare/smithery", fr: "/fr/comparer/smithery" },
  { en: "/compare/self-hosting", fr: "/fr/comparer/auto-hebergement" },
];

// The MCP server catalogue (app/servers, app/fr/serveurs) is a translated
// PREFIX: /servers/<slug>[/<client>] ↔ /fr/serveurs/<slug>[/<client>]. Every
// catalogue page and every per-MCP page has a French twin; the per-client
// guides exist in French only for FR_SERVER_CLIENT_GUIDE_SLUGS (a curated set
// of high-intent MCPs, so the long tail does not turn into thin translated
// pages; the test server `everything` and `calculator` were swapped out for
// notion, slack and postgres).
// Keep in sync with app/fr/serveurs and app/sitemap.ts (guarded by
// src/__tests__/server-pages.test.ts).
export const SERVERS_PATHS = { en: "/servers", fr: "/fr/serveurs" } as const;

export const FR_SERVER_CLIENT_GUIDE_SLUGS: readonly string[] = [
  "filesystem",
  "memory",
  "sequential-thinking",
  "fetch",
  "time",
  "git",
  "sqlite",
  "duckduckgo",
  "wikipedia",
  "markitdown",
  "shell",
  "duckdb",
  "arxiv",
  "notion",
  "slack",
  "postgres",
];

// The twin of a catalogue path in `target`'s language; null when it has none,
// undefined when `clean` is not a catalogue path at all.
function serversTwin(clean: string, target: Locale): string | null | undefined {
  let rest: string | null = null;
  for (const loc of LOCALES) {
    const base = SERVERS_PATHS[loc];
    if (clean === base) rest = "";
    else if (clean.startsWith(`${base}/`)) rest = clean.slice(base.length);
    if (rest !== null) break;
  }
  if (rest === null) return undefined;
  const parts = rest.split("/").filter(Boolean);
  if (parts.length > 2) return null;
  if (target === "fr" && parts.length === 2 && !FR_SERVER_CLIENT_GUIDE_SLUGS.includes(parts[0]!)) {
    return null;
  }
  return SERVERS_PATHS[target] + rest;
}

// The same page in `target`'s language, for a full pathname in either locale
// (e.g. "/plans" → "/fr/tarifs", "/fr/docs" → "/docs"), or null when that
// page has no version in `target`. Handles translated slugs and prefix twins.
export function localizedPath(pathname: string, target: Locale): string | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const twin = TRANSLATED_TWINS.find((t) => t.en === clean || t.fr === clean);
  if (twin) return twin[target];
  const servers = serversTwin(clean, target);
  if (servers !== undefined) return servers;
  const stripped = stripLocalePrefix(clean);
  if (target === "en") return stripped;
  if (!hasFrenchVersion(stripped)) return null;
  return stripped === "/" ? "/fr" : `/fr${stripped}`;
}

// Strips a leading `/fr` (if present) → the locale-agnostic path ("/" when empty).
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
}

// Detects the active locale from the current pathname.
export function localeFromPath(pathname: string): Locale {
  return pathname === "/fr" || pathname.startsWith("/fr/") ? "fr" : "en";
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
