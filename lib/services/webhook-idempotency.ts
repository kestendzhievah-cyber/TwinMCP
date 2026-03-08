/**
 * Shared in-memory idempotency cache for Stripe webhook endpoints.
 *
 * Both /api/webhook and /api/webhooks/stripe import this module so they
 * share the same Set.  In a single-process Next.js server the module is
 * loaded once → duplicate events coming through different endpoints are
 * properly de-duped.
 *
 * Events are kept for EVENT_TTL_MS then eligible for eviction, ensuring
 * that recent events are never accidentally purged under burst load.
 *
 * NOTE: This is per-process only.  For multi-instance deployments,
 * replace with a Redis SET + TTL.
 */

const _processedEvents = new Map<string, number>();
const MAX_CACHE = 2000;
const EVENT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns `true` the first time an eventId is seen, `false` thereafter.
 * Expired entries are purged lazily when the cache exceeds MAX_CACHE.
 */
export function markProcessed(eventId: string): boolean {
  const now = Date.now();
  if (_processedEvents.has(eventId)) return false;
  _processedEvents.set(eventId, now);

  // Evict expired entries when cache grows too large
  if (_processedEvents.size > MAX_CACHE) {
    for (const [key, ts] of _processedEvents) {
      if (now - ts > EVENT_TTL_MS) {
        _processedEvents.delete(key);
      }
    }
    // If still over limit after TTL eviction, drop oldest
    if (_processedEvents.size > MAX_CACHE) {
      const first = _processedEvents.keys().next().value;
      if (first) _processedEvents.delete(first);
    }
  }
  return true;
}
