import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Refuse to boot if the dev-auth bypass is enabled in production — it would
  // let anyone authenticate as any user via the X-TwinMCP-User-Id header.
  if (process.env.NODE_ENV === "production" && process.env.TWINMCP_ALLOW_DEV_AUTH === "1") {
    throw new Error(
      "TWINMCP_ALLOW_DEV_AUTH must not be set in production (auth bypass). Unset it and redeploy."
    );
  }

  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.2,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
