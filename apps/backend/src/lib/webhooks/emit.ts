import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema/webhooks";
import type { WebhookEventType } from "./events";
import { buildPayload, newEventId, newMessageId } from "./policy";

export type { WebhookEventType } from "./events";

// emitWebhookEvent (contract D5): called from hot-ish paths (MCP proxy 429,
// health reconcile, MCP install). It returns immediately; the fan-out — one
// delivery row per subscribed endpoint, then a "webhook-deliver" job each —
// happens in the background and never throws to the caller.

// Per-process cache of each user's active endpoints, so an account without
// webhooks (almost all of them) costs one indexed query a minute at most, not
// one per event. Single-container assumption like the auth cache; the CRUD
// routes invalidate it, other instances catch up within the TTL.
const ENDPOINT_CACHE_TTL_MS = 60_000;
const ENDPOINT_CACHE_MAX = 5_000;
type CachedEndpoint = { id: string; events: readonly string[] };
const endpointCache = new Map<string, { at: number; endpoints: CachedEndpoint[] }>();

export function invalidateWebhookEndpointCache(userId?: string): void {
  if (userId) endpointCache.delete(userId);
  else endpointCache.clear();
}

async function activeEndpoints(userId: string): Promise<CachedEndpoint[]> {
  const hit = endpointCache.get(userId);
  if (hit && Date.now() - hit.at < ENDPOINT_CACHE_TTL_MS) return hit.endpoints;
  const rows = await getDb()
    .select({ id: webhookEndpoints.id, events: webhookEndpoints.events })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.userId, userId), eq(webhookEndpoints.active, true)));
  if (endpointCache.size >= ENDPOINT_CACHE_MAX) endpointCache.clear();
  endpointCache.set(userId, { at: Date.now(), endpoints: rows });
  return rows;
}

/**
 * Insert one delivery row per endpoint for an event and queue each delivery.
 * Returns the delivery ids (message ids), in endpoint order.
 */
export async function createDeliveries(
  endpointIds: string[],
  type: WebhookEventType,
  data: Record<string, unknown>
): Promise<string[]> {
  if (endpointIds.length === 0) return [];
  const eventId = newEventId();
  const now = new Date();
  const payload = buildPayload(eventId, type, data, now);
  const rows = endpointIds.map((endpointId) => ({
    id: newMessageId(),
    endpointId,
    eventType: type,
    eventId,
    status: "pending" as const,
    payload,
    // Due now: if the process dies before the first attempt, the sweep
    // (retryDueDeliveries) still finds it.
    nextAttemptAt: now,
  }));
  await getDb().insert(webhookDeliveries).values(rows);
  return rows.map((r) => r.id);
}

/**
 * Fire-and-forget: deliver `type` with `data` to every active endpoint of
 * `userId` subscribed to it. Metadata only in `data` — never tool arguments,
 * results, secrets or config values.
 */
export function emitWebhookEvent(
  userId: string,
  type: WebhookEventType,
  data: Record<string, unknown>
): void {
  void (async () => {
    const endpoints = await activeEndpoints(userId);
    const targets = endpoints.filter((e) => e.events.includes(type)).map((e) => e.id);
    if (targets.length === 0) return;
    const ids = await createDeliveries(targets, type, data);
    const { scheduleDelivery } = await import("./deliver");
    for (const id of ids) {
      await scheduleDelivery(id).catch((err) =>
        console.error(`[webhooks] could not queue ${id}:`, err)
      );
    }
  })().catch((err) => {
    // Logged only: callers sit on paths whose own error reporting must stay
    // exact (e.g. the quota-limit nudge), and an unsent event is not an outage.
    console.warn(`[webhooks] emit ${type} failed:`, err);
  });
}
