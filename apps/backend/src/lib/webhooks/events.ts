// Webhook event catalogue (contract D5). Dependency-free so the dashboard's
// client components can import it; the schema and server code import it too.

export const webhookEventTypes = [
  "server.status_changed",
  "server.health_failed",
  "quota.reached",
  "mcp.installed",
  "test",
] as const;
export type WebhookEventType = (typeof webhookEventTypes)[number];

/** Events a user can subscribe an endpoint to ("test" is sent on demand only). */
export const SUBSCRIBABLE_EVENTS = webhookEventTypes.filter(
  (e): e is Exclude<WebhookEventType, "test"> => e !== "test"
);
export type SubscribableEvent = Exclude<WebhookEventType, "test">;

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, { label: string; help: string }> = {
  "server.status_changed": {
    label: "Server status changed",
    help: "A server moved between provisioning, running, stopped and error.",
  },
  "server.health_failed": {
    label: "Server health check failed",
    help: "The background health check found a server's box gone.",
  },
  "quota.reached": {
    label: "Daily quota reached",
    help: "Tool calls started being rejected at your plan's daily limit (at most once a day).",
  },
  "mcp.installed": {
    label: "MCP installed",
    help: "An MCP was added to one of your servers.",
  },
  test: { label: "Test", help: "Sent from the dashboard to check the endpoint." },
};

/** Keep only known, subscribable event names, de-duplicated, in canonical order. */
export function normalizeEvents(events: readonly string[]): SubscribableEvent[] {
  const wanted = new Set(events);
  return SUBSCRIBABLE_EVENTS.filter((e) => wanted.has(e));
}

/** Endpoints per account (an abuse cap, the same on every plan). */
export const MAX_ENDPOINTS_PER_USER = 10;

export const webhookDeliveryStatuses = [
  "pending", // inserted, first attempt not made yet
  "retrying", // an attempt failed, another one is scheduled
  "success", // a 2xx was received
  "failed", // every attempt failed (or a test attempt failed)
  "cancelled", // the endpoint was disabled/deleted before delivery
] as const;
export type WebhookDeliveryStatus = (typeof webhookDeliveryStatuses)[number];
