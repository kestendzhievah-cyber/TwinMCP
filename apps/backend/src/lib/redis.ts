import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash Redis env vars missing");
  }
  // The client's default retry policy (5 retries, exponential backoff) stalls
  // ~12 s before giving up when the host is dead (e.g. the database was deleted
  // and the REST URL still points at it: getaddrinfo ENOTFOUND). Both limiters
  // fail open on error, so a tight policy keeps a Redis outage from turning
  // every MCP request and every dashboard write into a 12-second hang.
  _redis = new Redis({
    url,
    token,
    retry: { retries: 2, backoff: (retryCount) => 100 * 2 ** retryCount },
  });
  return _redis;
}
