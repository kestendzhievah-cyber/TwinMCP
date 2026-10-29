import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { SUBSCRIBABLE_EVENTS } from "./events";
import { assertPublicHost, MAX_WEBHOOK_URL_LENGTH, validateWebhookUrl } from "./ssrf";

// Shared pieces of the /api/v2/webhooks routes.

const eventsSchema = z
  .array(z.enum(SUBSCRIBABLE_EVENTS as [string, ...string[]]))
  .min(1, "Pick at least one event.")
  .max(SUBSCRIBABLE_EVENTS.length);

export const createWebhookSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL.").max(MAX_WEBHOOK_URL_LENGTH),
  events: eventsSchema,
});

export const updateWebhookSchema = z
  .object({
    url: z.string().trim().min(1).max(MAX_WEBHOOK_URL_LENGTH).optional(),
    events: eventsSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => b.url !== undefined || b.events !== undefined || b.active !== undefined, {
    message: "Nothing to update.",
  });

/**
 * URL policy + DNS check, for create/update. Returns the normalized URL or a
 * user-facing reason.
 */
export async function checkWebhookTarget(
  raw: string
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const check = validateWebhookUrl(raw);
  if (!check.ok) return check;
  try {
    await assertPublicHost(check.url);
  } catch (err) {
    if (err instanceof Error && err.name === "SsrfBlockedError") {
      return { ok: false, reason: "Webhook URLs must point to a public address." };
    }
    return { ok: false, reason: "That host name does not resolve. Check the URL." };
  }
  return { ok: true, url: check.url.toString() };
}

/** checkAuthWriteLimit as a ready 429 (null when allowed). Fails open without Redis. */
export async function webhookWriteLimit(
  userId: string,
  action: "webhook_write" | "webhook_test"
): Promise<NextResponse | null> {
  const rl = await checkAuthWriteLimit(userId, action);
  if (rl.ok) return null;
  const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
  return jsonError(
    429,
    "Too many webhook operations. Please wait a moment and try again.",
    { retryAfter },
    { "Retry-After": String(retryAfter) }
  );
}

/** Public shape of an endpoint row: never the secret. */
export function serializeEndpoint(row: {
  id: string;
  url: string;
  events: readonly string[];
  active: boolean;
  createdAt: Date;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  failureCount: number;
}) {
  return {
    id: row.id,
    url: row.url,
    events: [...row.events],
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    failureCount: row.failureCount,
  };
}
export type PublicWebhookEndpoint = ReturnType<typeof serializeEndpoint>;

export function serializeDelivery(row: {
  id: string;
  eventType: string;
  eventId: string;
  status: string;
  responseCode: number | null;
  attempt: number;
  error: string | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    eventType: row.eventType,
    eventId: row.eventId,
    status: row.status,
    responseCode: row.responseCode,
    attempt: row.attempt,
    error: row.error,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type PublicWebhookDelivery = ReturnType<typeof serializeDelivery>;

/** Selected columns matching serializeEndpoint / serializeDelivery. */
export { endpointColumns, deliveryColumns } from "./columns";
