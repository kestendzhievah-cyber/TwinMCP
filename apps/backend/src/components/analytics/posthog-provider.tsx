"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  identifyUser,
  initAnalytics,
  isAnalyticsReady,
  resetAnalytics,
  trackPageview,
} from "@/lib/analytics/funnel";

/** Initialises PostHog on first mount, then tracks pageviews and the auth
 *  identity. Renders no DOM. Safe to mount multiple times. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Init once.
  useEffect(() => {
    initAnalytics();
  }, []);

  // 2. Manual pageviews on path / search change.
  useEffect(() => {
    if (!pathname) return;
    trackPageview(pathname, searchParams?.toString());
  }, [pathname, searchParams]);

  // 3. Identify (and reset on sign-out) using Supabase auth state.
  useEffect(() => {
    if (!isAnalyticsReady()) return;
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
