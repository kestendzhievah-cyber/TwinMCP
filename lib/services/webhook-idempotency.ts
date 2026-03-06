/**
 * Shared in-memory idempotency cache for Stripe webhook endpoints.
 *
 * Both /api/webhook and /api/webhooks/stripe import this module so they
 * share the same Set.  In a single-process Next.js server the module is
 * loaded once → duplicate events coming through different endpoints are
 * properly de-duped.
 *
 * NOTE: This is per-process only.  For multi-instance deployments,
 * replace with a Redis SET + TTL.
 */

const _processedEvents = new Set<string>();
const MAX_CACHE = 1000;

/**
 * Returns `true` the first time an eventId is seen, `false` thereafter.
 * Oldest entries are evicted once the cache exceeds MAX_CACHE.
 */
export function markProcessed(eventId: string): boolean {
  if (_processedEvents.has(eventId)) return false;
  _processedEvents.add(eventId);
  if (_processedEvents.size > MAX_CACHE) {
    const first = _processedEvents.values().next().value;
    if (first) _processedEvents.delete(first);
  }
  return true;
}
