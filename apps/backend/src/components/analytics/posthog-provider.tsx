"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { identifyUser, initAnalytics, resetAnalytics, trackPageview } from "@/lib/analytics/funnel";
import { CONSENT_EVENT } from "@/lib/analytics/consent";

/** Initialises PostHog on first mount, then tracks pageviews and the auth
 *  identity. Renders no DOM. Safe to mount multiple times. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Init once IF consent was already granted; otherwise wait for the cookie
  //    banner. initAnalytics() no-ops without consent, so this is safe to call
  //    eagerly. When the user accepts, re-init and capture the current page.
  useEffect(() => {
    initAnalytics();
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail !== "granted") return;
      initAnalytics();
      trackPageview(window.location.pathname, window.location.search.replace(/^\?/, ""));
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  // 2. Manual pageviews on path / search change.
  useEffect(() => {
    if (!pathname) return;
    trackPageview(pathname, searchParams?.toString());
  }, [pathname, searchParams]);

  // 3. Identify (and reset on sign-out) using Supabase auth state. identifyUser
  //    and resetAnalytics no-op until analytics is initialised (post-consent),
  //    so it's safe to always attach the listener.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
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

  return <>{children}</>;
}
