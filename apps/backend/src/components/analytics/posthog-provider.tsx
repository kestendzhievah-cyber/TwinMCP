"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  discardPendingAnalytics,
  identifyUser,
  initAnalytics,
  resetAnalytics,
  trackPageview,
} from "@/lib/analytics/funnel";
import { CONSENT_EVENT } from "@/lib/analytics/consent";

/** Manual pageviews on path / search change. Kept in its own leaf behind a
 *  Suspense boundary: useSearchParams() on a prerendered page bails out to
 *  client rendering up to the nearest boundary, and reading it in the provider
 *  itself would blank the server HTML of every static page (SEO). */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    trackPageview(pathname, searchParams?.toString());
  }, [pathname, searchParams]);
  return null;
}

/** Initialises PostHog on first mount, then tracks pageviews and the auth
 *  identity. Renders no DOM. Safe to mount multiple times. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // 1. Init once IF consent was already granted; otherwise wait for the cookie
  //    banner. initAnalytics() no-ops without consent, so this is safe to call
  //    eagerly. When the user accepts, re-init and capture the current page.
  useEffect(() => {
    void initAnalytics();
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail !== "granted") {
        // Refused: the events queued while the banner was open are dropped.
        discardPendingAnalytics();
        return;
      }
      // Await the lazy posthog load: it flushes the events queued before the
      // choice (original timestamps), then the current page is captured.
      void initAnalytics().then(() =>
        trackPageview(window.location.pathname, window.location.search.replace(/^\?/, ""))
      );
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  // 2. Identify (and reset on sign-out) using Supabase auth state. identifyUser
  //    and resetAnalytics no-op until analytics is initialised (post-consent),
  //    so it's safe to always attach the listener.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        // The plan is not on the Supabase session, so it is not sent here;
        // identifyUser accepts it for callers that know it.
        identifyUser(session.user.id, {
          email: session.user.email,
          signupDate: session.user.created_at,
        });
      }
      if (event === "SIGNED_OUT") {
        resetAnalytics();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      {/* 3. Pageviews (see PageviewTracker). */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
