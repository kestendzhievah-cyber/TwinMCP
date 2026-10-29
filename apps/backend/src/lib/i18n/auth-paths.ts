// The auth screens per locale. The French ones live under translated slugs
// (app/(auth-fr)/fr/…), registered as TRANSLATED_TWINS in ./locales.ts so the
// language switcher and hreflang pairs reach them. Pure and client-safe: the
// auth forms (client) and the auth routes (server) share it.

import type { Locale } from "./locales";

export type AuthPage = "signIn" | "signUp" | "forgotPassword" | "resetPassword";

export const AUTH_PATHS: Record<AuthPage, Record<Locale, string>> = {
  signIn: { en: "/sign-in", fr: "/fr/connexion" },
  signUp: { en: "/sign-up", fr: "/fr/inscription" },
  forgotPassword: { en: "/forgot-password", fr: "/fr/mot-de-passe-oublie" },
  resetPassword: { en: "/reset-password", fr: "/fr/nouveau-mot-de-passe" },
};

/**
 * The path of an auth screen in `locale`, with an optional query. Empty values
 * are dropped, so `authPath("signIn", "fr", { email: "" })` is "/fr/connexion".
 */
export function authPath(
  page: AuthPage,
  locale: Locale = "en",
  query?: Record<string, string | null | undefined> | URLSearchParams
): string {
  const base = AUTH_PATHS[page][locale];
  if (!query) return base;
  const q = new URLSearchParams();
  const entries = query instanceof URLSearchParams ? query.entries() : Object.entries(query);
  for (const [key, value] of entries) if (value) q.set(key, value);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Where a failed auth link (expired, already used, denied OAuth, failed code
 * exchange) sends the visitor: the sign-in screen of their language, with the
 * error code it explains, the page they were heading to (when not the
 * default) and the Pro intent query, so signing in from there still reaches
 * checkout.
 */
export function authFailurePath(opts: {
  errorCode: string;
  locale?: Locale;
  returnTo?: string | null;
  /** proIntentQuery(intent) from lib/auth/return-to.ts, or "" for none. */
  intentQuery?: string;
}): string {
  const q = new URLSearchParams({ error: opts.errorCode });
  if (opts.returnTo) q.set("returnTo", opts.returnTo);
  if (opts.intentQuery) {
    for (const [key, value] of new URLSearchParams(opts.intentQuery)) q.set(key, value);
  }
  return authPath("signIn", opts.locale ?? "en", q);
}

/** "fr" for `?locale=fr` (set by the French auth forms), otherwise "en". */
export function authLocaleParam(value: string | null | undefined): Locale {
  return value === "fr" ? "fr" : "en";
}
