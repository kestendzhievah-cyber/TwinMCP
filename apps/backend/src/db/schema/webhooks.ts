import { pgTable, text, timestamp, integer, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { users } from "./core";
import {
  webhookDeliveryStatuses,
  webhookEventTypes,
  type WebhookDeliveryStatus,
  type WebhookEventType,
} from "../../lib/webhooks/events";

// Outbound webhooks (contract D5). An endpoint is a user-owned HTTPS URL that
// receives Standard-Webhooks-signed POSTs (lib/webhooks/sign.ts) for the
// events it subscribes to. Its signing secret is stored encrypted
// (AES-256-GCM, lib/crypto/config-encryption) and shown to the user once.

export { webhookEventTypes, webhookDeliveryStatuses };
export type { WebhookEventType, WebhookDeliveryStatus };

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // JSON of an EncryptedPayload { ciphertext, iv, tag } wrapping the
    // "whsec_…" secret. Never returned by the API after creation.
    secretEncrypted: text("secret_encrypted").notNull(),
    events: text("events").array().$type<WebhookEventType[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    // Consecutive deliveries that failed every attempt. Reset to 0 by any
    // success; at WEBHOOK_DISABLE_AFTER_FAILURES the endpoint is disabled.
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [index("webhook_endpoints_user_idx").on(t.userId)]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    // "msg_…": also the Standard Webhooks `webhook-id` header, stable across
    // retries so receivers can deduplicate.
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    eventType: text("event_type").$type<WebhookEventType>().notNull(),
    // "evt_…": shared by every endpoint's delivery of the same event.
    eventId: text("event_id").notNull(),
    status: text("status").$type<WebhookDeliveryStatus>().notNull().default("pending"),
    responseCode: integer("response_code"),
    // Attempts made so far (0 until the first one completes).
    attempt: integer("attempt").notNull().default(0),
    // The signed body's JSON ({ id, type, timestamp, data }). Metadata only.
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    // Short transport error of the last failed attempt (timeout, DNS, SSRF…).
    error: text("error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_endpoint_created_idx").on(t.endpointId, t.createdAt),
    index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
  ]
);
