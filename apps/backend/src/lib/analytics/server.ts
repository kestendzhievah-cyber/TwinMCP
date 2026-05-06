// Server-side mirror for funnel events that originate in server actions or
// API routes (e.g. auth/callback firing signup_completed when the cookie is
// set). Uses the public ingestion endpoint — the project API key is also the
// public one, so no extra secret is needed.
//
// Fire-and-forget: never block a response on telemetry.

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

interface ServerEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export function trackServer(event: ServerEvent): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: event.event,
      distinct_id: event.distinctId,
      timestamp: new Date().toISOString(),
      properties: { ...(event.properties ?? {}), $lib: "twinmcp-server" },
    }),
  }).catch((err) => {
    // PostHog should never break the user flow.
    console.warn("[analytics/server] capture failed:", err);
  });
}
