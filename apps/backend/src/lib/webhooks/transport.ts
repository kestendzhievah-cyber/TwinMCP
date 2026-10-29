import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import {
  encryptConfig,
  decryptConfig,
  type EncryptedPayload,
} from "@/lib/crypto/config-encryption";
import { DELIVERY_TIMEOUT_MS } from "./policy";
import { guardedLookup, validateWebhookUrl } from "./ssrf";

// The HTTP side of a delivery. node:http(s) rather than fetch because it lets
// us (a) plug the SSRF-checking DNS lookup into the socket itself and (b) it
// never follows redirects: a 3xx is just a failed attempt.

/** Bytes of the receiver's response we read before hanging up (we only need the status). */
const MAX_RESPONSE_BYTES = 16 * 1024;

export class DeliveryTimeoutError extends Error {
  constructor() {
    super(`Timed out after ${DELIVERY_TIMEOUT_MS / 1000} s`);
    this.name = "TimeoutError";
  }
}

/**
 * POST `body` to `rawUrl` with `headers`. Resolves with the response status
 * (any status, 3xx included); rejects on a policy violation (SsrfBlockedError,
 * bad URL), DNS/TCP/TLS failure, or after `timeoutMs` in total.
 */
export function postWebhook(
  rawUrl: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number = DELIVERY_TIMEOUT_MS
): Promise<{ status: number }> {
  const check = validateWebhookUrl(rawUrl);
  if (!check.ok) return Promise.reject(new Error(check.reason));
  const url = check.url;
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = request(
      url,
      {
        method: "POST",
        lookup: guardedLookup as never,
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
          "user-agent": "TwinMCP-Webhooks/1.0",
          ...headers,
        },
      },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        let read = 0;
        res.on("data", (chunk: Buffer) => {
          read += chunk.length;
          if (read > MAX_RESPONSE_BYTES) res.destroy();
        });
        res.on("error", () => finish(() => resolve({ status })));
        res.on("close", () => finish(() => resolve({ status })));
        res.on("end", () => finish(() => resolve({ status })));
      }
    );

    const timer = setTimeout(() => {
      finish(() => reject(new DeliveryTimeoutError()));
      req.destroy();
    }, timeoutMs);
    timer.unref?.();

    req.on("error", (err) => finish(() => reject(err)));
    req.end(body);
  });
}

/** Encrypt a "whsec_…" secret for webhook_endpoints.secret_encrypted. */
export function encryptSecret(secret: string): string {
  return JSON.stringify(encryptConfig(secret));
}

export function decryptSecret(stored: string): string {
  const value = decryptConfig<unknown>(JSON.parse(stored) as EncryptedPayload);
  if (typeof value !== "string") throw new Error("Stored webhook secret is malformed");
  return value;
}
