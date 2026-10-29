// Where the auth screens' language switcher links to. Pure and client-safe.
//
// Built on localeSwitchTargets() (the same targets as the marketing switchers,
// translated slugs included), with two differences that matter on a form:
//   - only the sign-in / sign-up / forgot-password pairs get a switcher. The
//     reset-password screen is reached from an email link whose language was
//     already chosen (auth/confirm), so it has none;
//   - the query string is carried over, so `returnTo`, the Pro intent
//     (`plan`, `cadence`, `promo`), a prefilled `email` or an `error` code
//     survive the switch.

import { AUTH_PATHS, type AuthPage } from "./auth-paths";
import type { Locale } from "./locales";
import { localeSwitchTargets } from "./switch";

/** The auth screens that offer a language switcher. */
export const SWITCHABLE_AUTH_PAGES: readonly AuthPage[] = ["signIn", "signUp", "forgotPassword"];

/**
 * The current auth screen in each language, query included, or null when the
 * path is not a switchable auth screen (or has no twin).
 */
export function authSwitchTargets(
  pathname: string,
  search?: string | URLSearchParams | null
): Record<Locale, string> | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const switchable = SWITCHABLE_AUTH_PAGES.some((page) =>
    Object.values(AUTH_PATHS[page]).includes(clean)
  );
  if (!switchable) return null;
  const targets = localeSwitchTargets(clean);
  if (!targets) return null;
  const qs = (typeof search === "string" ? search : (search?.toString() ?? "")).replace(/^\?/, "");
  if (!qs) return targets;
  return { en: `${targets.en}?${qs}`, fr: `${targets.fr}?${qs}` };
}
