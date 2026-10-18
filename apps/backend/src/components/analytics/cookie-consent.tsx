"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAdsConsent,
  getConsent,
  needsConsentChoice,
  OPEN_COOKIE_SETTINGS,
  setConsent,
  setConsentChoices,
} from "@/lib/analytics/consent";

/**
 * Cookie consent banner. Shown until the visitor has made a choice for every
 * purpose (audience measurement and advertising), and re-openable via the
 * footer "Cookies" link (OPEN_COOKIE_SETTINGS). "Accept" and "Reject" apply to
 * every purpose; "Customize" lets the visitor choose per purpose (CNIL: consent
 * must be specific, and refusing as easy as accepting).
 *
 * Nothing non-essential runs before consent: PostHog is gated in
 * lib/analytics/funnel.ts, the Google Ads tag in lib/analytics/google-ads.ts.
 *
 * Copy is localized off the URL: /fr* → French, everything else → English, so
 * the consent is "informed" in the visitor's language (CNIL requirement).
 */
const COPY = {
  en: {
    aria: "Cookie consent",
    title: "We use cookies",
    lead: "With your consent, we use audience measurement cookies (PostHog) to improve the product, and advertising cookies (Google Ads) to measure our ads. Essential cookies (your session) are always on. See our ",
    privacy: "Privacy Policy",
    reject: "Reject",
    accept: "Accept",
    customize: "Customize",
    save: "Save my choices",
    essential: "Essential",
    essentialHelp: "Your session. Always on.",
    analytics: "Audience measurement",
    analyticsHelp: "PostHog: pages viewed and sign-up steps, to improve the product.",
    ads: "Advertising",
    adsHelp: "Google Ads: measures the visits and sign-ups that come from our ads.",
    alwaysOn: "Always on",
  },
  fr: {
    aria: "Consentement aux cookies",
    title: "Nous utilisons des cookies",
    lead: "Avec ton consentement, nous utilisons des cookies de mesure d'audience (PostHog) pour améliorer le produit, et des cookies publicitaires (Google Ads) pour mesurer nos annonces. Les cookies essentiels (ta session) sont toujours actifs. Voir notre ",
    privacy: "politique de confidentialité",
    reject: "Refuser",
    accept: "Accepter",
    customize: "Personnaliser",
    save: "Enregistrer mes choix",
    essential: "Essentiels",
    essentialHelp: "Ta session. Toujours actifs.",
    analytics: "Mesure d'audience",
    analyticsHelp: "PostHog : pages vues et étapes d'inscription, pour améliorer le produit.",
    ads: "Publicité",
    adsHelp: "Google Ads : mesure les visites et inscriptions qui viennent de nos annonces.",
    alwaysOn: "Toujours actifs",
  },
} as const;

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);
  const pathname = usePathname();
  const isFr = pathname?.startsWith("/fr") ?? false;
  const t = isFr ? COPY.fr : COPY.en;
  const privacyHref = isFr ? "/legal/privacy" : "/legal/en/privacy";

  useEffect(() => {
    // Pre-tick the boxes with the stored choices (unticked when undecided).
    const syncFromStorage = () => {
      setAnalytics(getConsent() === "granted");
      setAds(getAdsConsent() === "granted");
    };
    if (needsConsentChoice()) {
      syncFromStorage();
      setShow(true);
    }
    const onOpen = () => {
      syncFromStorage();
      setShow(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, onOpen);
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    setCustomizing(false);
  };

  const decideAll = (state: "granted" | "denied") => {
    setConsent(state);
    close();
  };

  const saveChoices = () => {
    setConsentChoices({
      analytics: analytics ? "granted" : "denied",
      ads: ads ? "granted" : "denied",
    });
    close();
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.aria}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:p-6"
    >
      <div className="max-h-[85vh] w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 overflow-y-auto border border-border bg-card shadow-stack duration-300 motion-reduce:animate-none">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="hidden h-10 w-10 shrink-0 place-items-center border border-border text-muted-foreground sm:grid">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="smallcaps tracking-sc text-sm font-medium text-foreground">{t.title}</p>
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

            {customizing && (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                <li className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="smallcaps tracking-sc text-xs font-medium text-foreground">
                      {t.essential}
                    </p>
                    <p className="mt-0.5 text-xs italic text-muted-foreground">{t.essentialHelp}</p>
                  </div>
                  <span className="smallcaps tracking-sc shrink-0 text-xs text-muted-foreground">
                    {t.alwaysOn}
                  </span>
                </li>
                <li>
                  <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
                    <span>
                      <span className="smallcaps tracking-sc block text-xs font-medium text-foreground">
                        {t.analytics}
                      </span>
                      <span className="mt-0.5 block text-xs italic text-muted-foreground">
                        {t.analyticsHelp}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-foreground"
                    />
                  </label>
                </li>
                <li>
                  <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
                    <span>
                      <span className="smallcaps tracking-sc block text-xs font-medium text-foreground">
                        {t.ads}
                      </span>
                      <span className="mt-0.5 block text-xs italic text-muted-foreground">
                        {t.adsHelp}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={ads}
                      onChange={(e) => setAds(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-foreground"
                    />
                  </label>
                </li>
              </ul>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {customizing ? (
                <Button size="sm" onClick={saveChoices} className="sm:min-w-[6rem]">
                  {t.save}
                </Button>
              ) : (
                <Button size="sm" onClick={() => decideAll("granted")} className="sm:min-w-[6rem]">
                  {t.accept}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => decideAll("denied")}
                className="sm:min-w-[6rem]"
              >
                {t.reject}
              </Button>
              {!customizing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomizing(true)}
                  aria-expanded={customizing}
                  className="sm:min-w-[6rem]"
                >
                  {t.customize}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
