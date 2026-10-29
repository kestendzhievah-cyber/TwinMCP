import { webhookDeliveries, webhookEndpoints } from "@/db/schema/webhooks";

/** Endpoint columns safe to read for display (no secret). */
export const endpointColumns = {
  id: webhookEndpoints.id,
  url: webhookEndpoints.url,
  events: webhookEndpoints.events,
  active: webhookEndpoints.active,
  createdAt: webhookEndpoints.createdAt,
  lastSuccessAt: webhookEndpoints.lastSuccessAt,
  lastFailureAt: webhookEndpoints.lastFailureAt,
  failureCount: webhookEndpoints.failureCount,
};

/** Delivery columns for display (no payload). */
export const deliveryColumns = {
  id: webhookDeliveries.id,
  endpointId: webhookDeliveries.endpointId,
  eventType: webhookDeliveries.eventType,
  eventId: webhookDeliveries.eventId,
  status: webhookDeliveries.status,
  responseCode: webhookDeliveries.responseCode,
  attempt: webhookDeliveries.attempt,
  error: webhookDeliveries.error,
  nextAttemptAt: webhookDeliveries.nextAttemptAt,
  createdAt: webhookDeliveries.createdAt,
  updatedAt: webhookDeliveries.updatedAt,
};
