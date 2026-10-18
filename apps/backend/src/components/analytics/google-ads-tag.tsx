"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ADS_CONSENT_EVENT } from "@/lib/analytics/consent";
import { loadGoogleAds, revokeGoogleAds, trackAdsPageview } from "@/lib/analytics/google-ads";

/** Loads the Google Ads tag after advertising consent, follows withdrawals, and
 *  reports client-side navigations. Renders no DOM. */
export function GoogleAdsTag() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    loadGoogleAds();
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail === "granted") loadGoogleAds();
      else revokeGoogleAds();
    };
    window.addEventListener(ADS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ADS_CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    // The initial page view is sent by gtag("config"); only report later ones.
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (pathname) trackAdsPageview(pathname);
  }, [pathname]);

  return null;
}
