// What the language switchers link to. Pure and client-safe.

import { LOCALES, localizedPath, type Locale } from "./locales";

/**
 * The current page in every locale, for a full pathname in either language
 * ("/plans" → { en: "/plans", fr: "/fr/tarifs" }), or null when one of them
 * does not exist: the switcher then hides itself rather than link to a 404.
 * Goes through localizedPath(), so translated slugs (TRANSLATED_TWINS) and
 * plain /fr prefix twins (hasFrenchVersion) are both covered.
 */
export function localeSwitchTargets(pathname: string): Record<Locale, string> | null {
  const targets = {} as Record<Locale, string>;
  for (const loc of LOCALES) {
    const path = localizedPath(pathname, loc);
    if (!path) return null;
    targets[loc] = path;
  }
  return targets;
}
