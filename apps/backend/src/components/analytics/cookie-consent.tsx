"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConsent, setConsent, OPEN_COOKIE_SETTINGS } from "@/lib/analytics/consent";

/**
 * Cookie consent banner. Shown until the visitor accepts or rejects analytics
 * cookies, and re-openable via the footer "Cookies" link (OPEN_COOKIE_SETTINGS).
 * No analytics cookies are set before "Accept" — that gate lives in
 * lib/analytics/funnel.ts (initAnalytics checks hasAnalyticsConsent).
 *
 * Copy is localized off the URL: /fr* → French, everything else → English, so
 * the consent is "informed" in the visitor's language (CNIL requirement).
 */
const COPY = {
  en: {
    aria: "Cookie consent",
    title: "We use cookies",
    lead: "Analytics cookies (PostHog) are set only with your consent, to improve the product. Essential cookies (your session) are always on. See our ",
    privacy: "Privacy Policy",
    reject: "Reject",
    accept: "Accept",
  },
  fr: {
    aria: "Consentement aux cookies",
    title: "Nous utilisons des cookies",
    lead: "Les cookies de mesure d'audience (PostHog) ne sont déposés qu'avec ton consentement, pour améliorer le produit. Les cookies essentiels (ta session) sont toujours actifs. Voir notre ",
    privacy: "politique de confidentialité",
    reject: "Refuser",
    accept: "Accepter",
  },
} as const;

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  const isFr = pathname?.startsWith("/fr") ?? false;
  const t = isFr ? COPY.fr : COPY.en;
  const privacyHref = isFr ? "/legal/privacy" : "/legal/en/privacy";

  useEffect(() => {
    if (getConsent() === "unset") setShow(true);
    const onOpen = () => setShow(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, onOpen);
  }, []);

  if (!show) return null;

  const decide = (state: "granted" | "denied") => {
    setConsent(state);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.aria}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/5 duration-300 motion-reduce:animate-none dark:shadow-black/40">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-foreground sm:grid">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-foreground">{t.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t.lead}
              <Link
                href={privacyHref as Route}
                className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
              >
                {t.privacy}
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button size="sm" onClick={() => decide("granted")} className="sm:min-w-[6rem]">
                {t.accept}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => decide("denied")}
                className="sm:min-w-[6rem]"
              >
                {t.reject}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
