import { randomBytes } from "node:crypto";
import type { WebhookEventType } from "./events";

// Pure, server-side delivery policy: the retry schedule, auto-disable
// threshold, ids and the signed payload shape.

/** Per-request timeout of one delivery attempt. */
export const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Delay before each RETRY, in seconds: attempt 1 is immediate, attempt n+1
 * waits RETRY_DELAYS_SEC[n-1]. 6 attempts spread over about 7.2 hours.
 */
export const RETRY_DELAYS_SEC = [30, 120, 600, 3_600, 6 * 3_600] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_SEC.length + 1;

/**
 * Seconds to wait before the next attempt after `attemptsMade` failed ones, or
 * null when the delivery has used all its attempts. `jitter` in [0,1) spreads
 * a burst of retries by up to +10 % (0 gives the exact schedule).
 */
export function nextRetryDelaySec(attemptsMade: number, jitter = 0): number | null {
  if (!Number.isInteger(attemptsMade) || attemptsMade < 1) return null;
  const base = RETRY_DELAYS_SEC[attemptsMade - 1];
  if (base === undefined) return null;
  return Math.round(base * (1 + 0.1 * Math.min(Math.max(jitter, 0), 0.999)));
}

/** Consecutive fully failed deliveries after which an endpoint is disabled. */
export const WEBHOOK_DISABLE_AFTER_FAILURES = 20;

export function shouldDisableEndpoint(consecutiveFailures: number): boolean {
  return consecutiveFailures >= WEBHOOK_DISABLE_AFTER_FAILURES;
}

/** 2xx = delivered. Everything else (3xx included: redirects are not followed) fails. */
export function isSuccessStatus(code: number | null | undefined): boolean {
  return typeof code === "number" && code >= 200 && code < 300;
}

function randomId(prefix: string): string {
  return `${prefix}${randomBytes(16).toString("hex")}`;
}

/** Standard Webhooks message id (one per endpoint delivery, stable across retries). */
export const newMessageId = () => randomId("msg_");
/** One per emitted event, shared by every endpoint that receives it. */
export const newEventId = () => randomId("evt_");

export interface WebhookPayload {
  [key: string]: unknown;
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/** The signed JSON body: the Standard Webhooks { type, timestamp, data } shape plus the event id. */
export function buildPayload(
  eventId: string,
  type: WebhookEventType,
  data: Record<string, unknown>,
  now: Date = new Date()
): WebhookPayload {
  return { id: eventId, type, timestamp: now.toISOString(), data };
}

/** Trim a transport error to something safe and short for the deliveries table. */
export function describeDeliveryError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { name?: string; code?: string; message?: string };
    if (e.name === "SsrfBlockedError") return "Blocked: the URL resolves to a private address";
    if (e.name === "TimeoutError" || e.code === "ETIMEDOUT") return "Timed out after 10 s";
    if (e.code === "ENOTFOUND" || e.code === "EAI_AGAIN") return "DNS lookup failed";
    if (e.code === "ECONNREFUSED") return "Connection refused";
    if (e.code === "ECONNRESET") return "Connection reset";
    if (e.code && /^(CERT_|ERR_TLS|UNABLE_TO|DEPTH_ZERO|SELF_SIGNED)/.test(e.code)) {
      return "TLS certificate error";
    }
    // Any other transport error: a generic category only. The raw message can
    // describe the network path (and the test endpoint reports it back).
    if (e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH") return "Host unreachable";
  }
  return "Delivery failed";
}
