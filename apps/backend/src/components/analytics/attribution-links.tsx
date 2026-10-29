"use client";

import { useEffect } from "react";
import { readAttribution, withAttribution } from "@/lib/analytics/attribution";

// Carries the landing URL's campaign keys (utm_*, gclid, ref) onto the links
// that lead to sign-up, pricing and onboarding, so the sign-up form can save
// them on the new account (users.metadata.attribution) and the checkout can pass
// them to Stripe.
//
// CNIL: nothing is stored on the device (no cookie, no localStorage); the keys
// only travel in the URL the visitor is already on. No consent is needed.

/** Pages whose links should carry the attribution keys. */
export const ATTRIBUTION_TARGET_PATHS = [
  "/sign-up",
  "/fr/inscription",
  "/plans",
  "/fr/tarifs",
  "/onboarding",
] as const;

/** True for a same-origin link to one of ATTRIBUTION_TARGET_PATHS. */
export function isAttributionTarget(anchor: HTMLAnchorElement): boolean {
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#")) return false;
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return false;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return ATTRIBUTION_TARGET_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  } catch {
    return false;
  }
}

/**
 * The attributed href for a link, or null when the current URL carries no
 * attribution key or the link does not lead to a target page.
 */
export function attributedHref(
  anchor: HTMLAnchorElement,
  search: string = window.location.search
): string | null {
  const attribution = readAttribution(search);
  if (!attribution || !isAttributionTarget(anchor)) return null;
  const raw = anchor.getAttribute("href");
  return raw ? withAttribution(raw, attribution) : null;
}

/**
 * Rewrites the href of every target link on the page (covers middle-click,
 * "open in new tab" and copied links). A plain left click on a Next.js <Link>
 * navigates with its React `href` prop instead of the DOM attribute, so the
 * marketing header's delegated click handler re-routes those through
 * attributedHref(). Renders no DOM; a no-op on organic visits.
 */
export function AttributionLinks() {
  useEffect(() => {
    const attribution = readAttribution(window.location.search);
    if (!attribution) return;

    const rewrite = () => {
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        if (!isAttributionTarget(a)) return;
        const raw = a.getAttribute("href");
        if (!raw) return;
        const next = withAttribution(raw, attribution);
        if (next !== raw) a.setAttribute("href", next);
      });
    };

    rewrite();
    // Late-mounting links (suspended sections, menus rendered on demand).
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        rewrite();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
