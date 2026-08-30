import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Session Replay is intentionally NOT registered: its integration is a heavy
    // (~40KB) client add-on that shipped on every page. Error capture + tracing
    // stay. To re-enable replays, add replayIntegration() back (and note the
    // lazy-load path pulls from the Sentry CDN, which the strict CSP blocks).
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
