"use client";

import { openCookieSettings } from "@/lib/analytics/consent";

/** Re-opens the cookie consent banner so users can withdraw/change consent
 *  (required by CNIL/CPDP to be as easy as granting it). */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookies
    </button>
  );
}
