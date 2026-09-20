"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    lead: "We use analytics cookies (PostHog) only with your consent, to improve the product. Essential cookies (your session) are always on. See our ",
    privacy: "Privacy Policy",
    reject: "Reject",
    accept: "Accept",
  },
  fr: {
    aria: "Consentement aux cookies",
    lead: "Nous utilisons des cookies de mesure d'audience (PostHog) uniquement avec ton consentement, pour améliorer le produit. Les cookies essentiels (ta session) sont toujours actifs. Voir notre ",
    privacy: "politique de confidentialité",
    reject: "Refuser",
    accept: "Accepter",
  },
} as const;

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  const t = pathname?.startsWith("/fr") ? COPY.fr : COPY.en;

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
      aria-label={t.aria}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border/60 bg-background/95 px-4 py-4 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t.lead}
          <Link href="/legal/privacy" className="underline hover:text-foreground">
            {t.privacy}
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide("denied")}>
            {t.reject}
          </Button>
          <Button size="sm" onClick={() => decide("granted")}>
            {t.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
