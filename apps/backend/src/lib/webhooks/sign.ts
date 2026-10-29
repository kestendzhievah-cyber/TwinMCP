import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Standard Webhooks (https://www.standardwebhooks.com) signing. Every delivery
// carries three headers:
//   webhook-id         the message id ("msg_…", stable across retries)
//   webhook-timestamp  unix seconds of this attempt
//   webhook-signature  "v1,<base64 HMAC-SHA256(key, `${id}.${timestamp}.${body}`)>"
// where key = base64-decode of the secret after its "whsec_" prefix. Any
// Standard Webhooks / Svix verifier library accepts these as-is.

export const SECRET_PREFIX = "whsec_";
const SECRET_BYTES = 32;

/** A fresh "whsec_<base64 of 32 random bytes>" signing secret. */
export function generateWebhookSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(SECRET_BYTES).toString("base64")}`;
}

/** The HMAC key bytes of a "whsec_…" secret (a bare base64 secret is accepted too). */
export function secretKeyBytes(secret: string): Buffer {
  const b64 = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret;
  const key = Buffer.from(b64, "base64");
  if (key.length === 0) throw new Error("Webhook secret is empty or not base64");
  return key;
}

/** "v1,<base64 signature>" for one message. */
export function signWebhook(
  secret: string,
  msgId: string,
  timestampSec: number,
  body: string
): string {
  const mac = createHmac("sha256", secretKeyBytes(secret))
    .update(`${msgId}.${timestampSec}.${body}`, "utf8")
    .digest("base64");
  return `v1,${mac}`;
}

/** The three Standard Webhooks headers for one attempt. */
export function webhookHeaders(
  secret: string,
  msgId: string,
  body: string,
  now: Date = new Date()
): Record<string, string> {
  const ts = Math.floor(now.getTime() / 1000);
  return {
    "webhook-id": msgId,
    "webhook-timestamp": String(ts),
    "webhook-signature": signWebhook(secret, msgId, ts, body),
  };
}

/** Default tolerance a receiver applies to webhook-timestamp (5 minutes). */
export const SIGNATURE_TOLERANCE_SEC = 300;

/**
 * Receiver-side check (used by tests and documented for customers): true when
 * one of the space-separated "v1,…" signatures matches and the timestamp is
 * within the tolerance.
 */
export function verifyWebhook(
  secret: string,
  headers: { id: string; timestamp: string; signature: string },
  body: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  toleranceSec: number = SIGNATURE_TOLERANCE_SEC
): boolean {
  const ts = Number(headers.timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  const expected = Buffer.from(signWebhook(secret, headers.id, ts, body).slice(3), "base64");
  for (const part of headers.signature.split(" ")) {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || !sig) continue;
    const got = Buffer.from(sig, "base64");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return true;
  }
  return false;
}
