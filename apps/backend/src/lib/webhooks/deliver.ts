import { and, eq, inArray, lte, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users } from "@/db/schema/core";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema/webhooks";
import {
  describeDeliveryError,
  isSuccessStatus,
  MAX_ATTEMPTS,
  nextRetryDelaySec,
  shouldDisableEndpoint,
} from "./policy";
import { webhookHeaders } from "./sign";
import { decryptSecret, postWebhook } from "./transport";

// One delivery attempt, run by the "webhook-deliver" job. The delivery row is
// the source of truth: an attempt is claimed atomically (attempt = attempt+1
// WHERE attempt = <read>), so a duplicate job — a QStash redelivery, or the
// sweep racing a timer — never double-sends. Nothing here throws.

export type DeliveryOutcome =
  | { status: "success"; responseCode: number; attempt: number }
  | {
      status: "retrying" | "failed";
      responseCode: number | null;
      attempt: number;
      error: string | null;
    }
  | { status: "skipped"; reason: string };

/** A duplicate job that shows up this early before its slot is ignored. */
const EARLY_TOLERANCE_MS = 5_000;

/**
 * While an attempt runs, next_attempt_at holds this lease. If the process dies
 * mid-attempt, the row becomes due again once the lease expires and the sweep
 * (retryDueDeliveries) picks it up. A duplicate job arriving during the lease
 * is skipped as "not due yet". Longer than the 10 s request timeout + DB writes.
 */
const ATTEMPT_LEASE_MS = 60_000;

/**
 * Schedule the "webhook-deliver" job (QStash in production, inline otherwise).
 * The queue is imported lazily: lib/queue/qstash imports this module.
 */
export async function scheduleDelivery(deliveryId: string, delaySeconds = 0): Promise<void> {
  const { enqueue } = await import("@/lib/queue/qstash");
  await enqueue({ type: "webhook-deliver", deliveryId }, { delaySeconds });
}

export async function deliverWebhook(
  deliveryId: string,
  opts: { maxAttempts?: number } = {}
): Promise<DeliveryOutcome> {
  try {
    return await attempt(deliveryId, opts.maxAttempts ?? MAX_ATTEMPTS);
  } catch (err) {
    console.error(`[webhooks] delivery ${deliveryId} crashed:`, err);
    Sentry.captureException(err, { tags: { area: "webhooks", stage: "deliver" } });
    return { status: "skipped", reason: "internal error" };
  }
}

async function attempt(deliveryId: string, maxAttempts: number): Promise<DeliveryOutcome> {
  const db = getDb();
  const [row] = await db
    .select({
      delivery: {
        id: webhookDeliveries.id,
        eventType: webhookDeliveries.eventType,
        status: webhookDeliveries.status,
        attempt: webhookDeliveries.attempt,
        payload: webhookDeliveries.payload,
        nextAttemptAt: webhookDeliveries.nextAttemptAt,
      },
      endpoint: {
        id: webhookEndpoints.id,
        userId: webhookEndpoints.userId,
        url: webhookEndpoints.url,
        secretEncrypted: webhookEndpoints.secretEncrypted,
        active: webhookEndpoints.active,
      },
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!row) return { status: "skipped", reason: "not found" };
  const { delivery, endpoint } = row;

  if (delivery.status !== "pending" && delivery.status !== "retrying") {
    return { status: "skipped", reason: `already ${delivery.status}` };
  }
  if (
    delivery.nextAttemptAt &&
    delivery.nextAttemptAt.getTime() - Date.now() > EARLY_TOLERANCE_MS
  ) {
    return { status: "skipped", reason: "not due yet" };
  }
  // A disabled endpoint receives nothing more (tests are sent to it anyway).
  if (!endpoint.active && delivery.eventType !== "test") {
    await db
      .update(webhookDeliveries)
      .set({ status: "cancelled", nextAttemptAt: null, updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, deliveryId));
    return { status: "skipped", reason: "endpoint disabled" };
  }

  // A dashboard test gets one attempt, even when a crash left it to the sweep.
  const max = delivery.eventType === "test" ? 1 : maxAttempts;
  // Every attempt already made (an attempt interrupted by a crash counts):
  // close the delivery instead of sending once more.
  if (delivery.attempt >= max) {
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", nextAttemptAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.attempt, delivery.attempt),
          inArray(webhookDeliveries.status, ["pending", "retrying"])
        )
      );
    return { status: "skipped", reason: "attempts exhausted" };
  }

  // Claim this attempt (with a lease, see ATTEMPT_LEASE_MS).
  const attemptNo = delivery.attempt + 1;
  const claimedAt = new Date();
  const claimed = await db
    .update(webhookDeliveries)
    .set({
      attempt: attemptNo,
      nextAttemptAt: new Date(claimedAt.getTime() + ATTEMPT_LEASE_MS),
      updatedAt: claimedAt,
    })
    .where(
      and(
        eq(webhookDeliveries.id, deliveryId),
        eq(webhookDeliveries.attempt, delivery.attempt),
        inArray(webhookDeliveries.status, ["pending", "retrying"])
      )
    )
    .returning({ id: webhookDeliveries.id });
  if (claimed.length === 0) return { status: "skipped", reason: "claimed elsewhere" };

  // Send. The body is serialized once and signed byte-for-byte.
  const body = JSON.stringify(delivery.payload);
  let responseCode: number | null = null;
  let error: string | null = null;
  try {
    const secret = decryptSecret(endpoint.secretEncrypted);
    const res = await postWebhook(endpoint.url, body, webhookHeaders(secret, delivery.id, body));
    responseCode = res.status;
    if (!isSuccessStatus(res.status)) error = `HTTP ${res.status}`;
  } catch (err) {
    error = describeDeliveryError(err);
  }
  const now = new Date();

  if (isSuccessStatus(responseCode)) {
    await db
      .update(webhookDeliveries)
      .set({ status: "success", responseCode, error: null, nextAttemptAt: null, updatedAt: now })
      .where(eq(webhookDeliveries.id, deliveryId));
    await db
      .update(webhookEndpoints)
      .set({ lastSuccessAt: now, failureCount: 0 })
      .where(eq(webhookEndpoints.id, endpoint.id));
    return { status: "success", responseCode: responseCode as number, attempt: attemptNo };
  }

  // Failed attempt: retry later, or give up.
  const delay = attemptNo < max ? nextRetryDelaySec(attemptNo, Math.random()) : null;
  if (delay !== null) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "retrying",
        responseCode,
        error,
        nextAttemptAt: new Date(now.getTime() + delay * 1000),
        updatedAt: now,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    await db
      .update(webhookEndpoints)
      .set({ lastFailureAt: now })
      .where(eq(webhookEndpoints.id, endpoint.id));
    await scheduleDelivery(deliveryId, delay).catch((err) => {
      // The row keeps next_attempt_at, so retryDueDeliveries() picks it up.
      console.error(`[webhooks] could not schedule retry of ${deliveryId}:`, err);
    });
    return { status: "retrying", responseCode, attempt: attemptNo, error };
  }

  await db
    .update(webhookDeliveries)
    .set({ status: "failed", responseCode, error, nextAttemptAt: null, updatedAt: now })
    .where(eq(webhookDeliveries.id, deliveryId));

  // A dashboard test never counts toward auto-disable.
  if (delivery.eventType === "test") {
    await db
      .update(webhookEndpoints)
      .set({ lastFailureAt: now })
      .where(eq(webhookEndpoints.id, endpoint.id));
    return { status: "failed", responseCode, attempt: attemptNo, error };
  }

  const [counted] = await db
    .update(webhookEndpoints)
    .set({ lastFailureAt: now, failureCount: sql`${webhookEndpoints.failureCount} + 1` })
    .where(eq(webhookEndpoints.id, endpoint.id))
    .returning({ failureCount: webhookEndpoints.failureCount });
  if (counted && shouldDisableEndpoint(counted.failureCount)) {
    await disableEndpoint(endpoint.id, endpoint.userId, endpoint.url, counted.failureCount, error);
  }
  return { status: "failed", responseCode, attempt: attemptNo, error };
}

/**
 * Turn the endpoint off and email its owner — once: the update only matches
 * while the endpoint is still active, so concurrent failures send one email.
 */
async function disableEndpoint(
  endpointId: string,
  userId: string,
  url: string,
  failures: number,
  lastError: string | null
): Promise<void> {
  const db = getDb();
  const flipped = await db
    .update(webhookEndpoints)
    .set({ active: false })
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.active, true)))
    .returning({ id: webhookEndpoints.id });
  if (flipped.length === 0) return;
  const { invalidateWebhookEndpointCache } = await import("./emit");
  invalidateWebhookEndpointCache(userId);
  console.warn(`[webhooks] endpoint ${endpointId} disabled after ${failures} failed deliveries`);

  try {
    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!owner?.email || owner.email.endsWith("@placeholder.twinmcp.fr")) return;
    const { sendWebhookDisabledEmail } = await import("@/lib/email");
    await sendWebhookDisabledEmail(owner.email, { url, failures, lastError });
  } catch (err) {
    console.warn("[webhooks] disabled-endpoint email not sent:", err);
    Sentry.captureException(err, { tags: { area: "webhooks", stage: "disabled-email" } });
  }
}

/**
 * Re-schedule deliveries whose retry is overdue — the inline queue keeps its
 * timers in memory, so a restart loses them. Safe to run any time (the claim
 * in attempt() stops double-sends). Returns how many were re-queued.
 */
export async function retryDueDeliveries(limit = 100): Promise<number> {
  const due = await getDb()
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        inArray(webhookDeliveries.status, ["pending", "retrying"]),
        lte(webhookDeliveries.nextAttemptAt, new Date())
      )
    )
    .limit(limit);
  for (const d of due) {
    await scheduleDelivery(d.id).catch((err) =>
      console.error(`[webhooks] could not re-queue ${d.id}:`, err)
    );
  }
  return due.length;
}
