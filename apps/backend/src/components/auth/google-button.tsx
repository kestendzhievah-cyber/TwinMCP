"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { track } from "@/lib/analytics/funnel";
import { ATTRIBUTION_KEYS, readAttribution } from "@/lib/analytics/attribution";
import { friendlyAuthError } from "@/lib/auth/errors";
import type { Locale } from "@/lib/i18n/locales";

const COPY = {
  en: { label: "Continue with Google", loading: "Opening Google…", or: "or" },
  fr: { label: "Continuer avec Google", loading: "Ouverture de Google…", or: "ou" },
} as const;

/**
 * The official multicolour Google "G" (Google Identity sign-in branding: the
 * mark is used unmodified on a white button with a neutral border).
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-[18px] w-[18px] shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google": Supabase OAuth (PKCE) back to /auth/callback, which
 * creates the session and grants the sign-up credit to a new account (Google
 * verifies the address). The page decides whether to render it (only when the
 * provider is enabled in Supabase, lib/auth/oauth-providers.ts).
 *
 * `callbackUrl` is the same /auth/callback URL the email flow uses (returnTo,
 * plan intent, locale). First-touch attribution rides along in it, because an
 * OAuth sign-up has no form metadata to carry it.
 */
export function GoogleButton({
  locale = "en",
  callbackUrl,
  onError,
}: {
  locale?: Locale;
  callbackUrl: () => string;
  onError: (message: string) => void;
}) {
  const t = COPY[locale];
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    onError("");
    track({ name: "oauth_clicked", properties: { provider: "google" } });
    const target = new URL(callbackUrl());
    const attribution = readAttribution(window.location.search, {
      path: window.location.pathname,
      locale,
      referrer: document.referrer,
    });
    for (const k of ATTRIBUTION_KEYS) {
      const v = attribution?.[k];
      if (v && !target.searchParams.has(k)) target.searchParams.set(k, v);
    }
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: target.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      onError(friendlyAuthError(error, locale));
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full gap-3 bg-card"
      onClick={start}
      disabled={loading}
      data-cta-location="auth_google"
    >
      <GoogleMark />
      {loading ? t.loading : t.label}
    </Button>
  );
}

/** The "or" rule between the Google button and the email form. */
export function AuthDivider({ locale = "en" }: { locale?: Locale }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <span aria-hidden className="h-px flex-1 bg-border" />
      {COPY[locale].or}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
