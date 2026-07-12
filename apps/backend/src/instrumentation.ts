import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Refuse to boot if the dev-auth bypass is enabled in production — it would
  // let anyone authenticate as any user via the X-TwinMCP-User-Id header.
  if (process.env.NODE_ENV === "production" && process.env.TWINMCP_ALLOW_DEV_AUTH === "1") {
    throw new Error(
      "TWINMCP_ALLOW_DEV_AUTH must not be set in production (auth bypass). Unset it and redeploy."
    );
  }

  if (
    process.env.SENTRY_DSN &&
    (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge")
  ) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.2,
    });
  }

  // Optional in-process box-health reconciliation (nodejs only). Set
  // RECONCILE_HEALTH_INTERVAL_MS to enable on a single long-lived container;
  // otherwise use a QStash `reconcile-health` cron. Flips servers whose box was
  // deleted/reaped to `error` and refreshes heartbeats — paused/idle boxes are
  // healthy and left alone. Clamped to ≥60s; runs never overlap.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const interval = Number(process.env.RECONCILE_HEALTH_INTERVAL_MS ?? 0);
    if (Number.isFinite(interval) && interval > 0) {
      const ms = Math.max(interval, 60_000);
      const { reconcileServerHealth } = await import("./lib/health");
      let inFlight = false;
      setInterval(() => {
        if (inFlight) return;
        inFlight = true;
        reconcileServerHealth()
          .catch((err) => Sentry.captureException(err, { tags: { area: "health-reconcile" } }))
          .finally(() => {
            inFlight = false;
          });
      }, ms).unref?.();
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
