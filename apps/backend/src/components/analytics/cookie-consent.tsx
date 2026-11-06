"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    // Phones: a two-line first layer; "Customize" carries the per-purpose detail.
    leadShort: "Audience (PostHog) and advertising (Google Ads) cookies, only with your consent. ",
    privacyShort: "Privacy",
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
    lead: "Avec votre consentement, nous utilisons des cookies de mesure d'audience (PostHog) pour améliorer le produit, et des cookies publicitaires (Google Ads) pour mesurer nos annonces. Les cookies essentiels (votre session) sont toujours actifs. Voir notre ",
    privacy: "politique de confidentialité",
    leadShort:
      "Cookies d'audience (PostHog) et publicitaires (Google Ads), seulement avec votre accord. ",
    privacyShort: "Confidentialité",
    reject: "Refuser",
    accept: "Accepter",
    customize: "Personnaliser",
    save: "Enregistrer mes choix",
    essential: "Essentiels",
    essentialHelp: "Votre session. Toujours actifs.",
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

  const customizeButton = (className: string) => (
    <Button
      variant="link"
      size="sm"
      onClick={() => setCustomizing(true)}
      aria-expanded={customizing}
      className={className}
    >
      {t.customize}
    </Button>
  );

  // Below md the banner is a compact bottom bar (about 110px tall) so it never
  // covers the hero CTA and its terms line on a first visit. Accept and Reject
  // carry equal weight (both outline, side by side): refusing is as easy as
  // accepting, and neither competes with the page's one rose button.
  // From lg it sits bottom-right, over the hero's config card rather than its
  // CTA column.
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.aria}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-2 sm:p-4 md:p-6 lg:justify-end"
    >
      <div
        className={cn(
          "w-full max-w-2xl lg:max-w-md animate-in fade-in slide-in-from-bottom-4 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl duration-300 motion-reduce:animate-none",
          customizing ? "max-h-[85vh]" : "max-h-[180px] md:max-h-[85vh]"
        )}
      >
        <div className="flex flex-col gap-4 p-3 sm:p-5 md:flex-row md:items-start">
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand md:grid">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {/* Phones drop the visible title (the dialog keeps its aria-label)
                so the bar stays at two lines of copy plus one row of buttons. */}
            <p className="hidden text-sm font-semibold text-foreground md:block">{t.title}</p>
            <p className="text-xs leading-snug text-muted-foreground md:hidden">
              {t.leadShort}
              <Link
                href={privacyHref as Route}
                className="font-medium text-brand underline underline-offset-2 hover:opacity-80"
              >
                {t.privacyShort}
              </Link>
              .
            </p>
            <p className="mt-1 hidden text-sm leading-relaxed text-muted-foreground md:block">
              {t.lead}
              <Link
                href={privacyHref as Route}
                className="font-medium text-brand underline underline-offset-2 hover:opacity-80"
              >
                {t.privacy}
              </Link>
              .
            </p>

            {customizing && (
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border px-3">
                <li className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.essential}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.essentialHelp}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {t.alwaysOn}
                  </span>
                </li>
                <li>
                  <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {t.analytics}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t.analyticsHelp}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
                    />
                  </label>
                </li>
                <li>
                  <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{t.ads}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t.adsHelp}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={ads}
                      onChange={(e) => setAds(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
                    />
                  </label>
                </li>
              </ul>
            )}

            <div
              className={cn(
                "mt-2 grid gap-2 md:mt-4 md:flex md:flex-row md:flex-wrap",
                customizing ? "grid-cols-2" : "grid-cols-[1fr_1fr_auto]"
              )}
            >
              {customizing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveChoices}
                  className="md:min-w-[6rem]"
                >
                  {t.save}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => decideAll("granted")}
                  className="md:min-w-[6rem]"
                >
                  {t.accept}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => decideAll("denied")}
                className="md:min-w-[6rem]"
              >
                {t.reject}
              </Button>
              {!customizing && customizeButton("px-1 text-xs md:min-w-[6rem] md:px-3.5 md:text-sm")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
