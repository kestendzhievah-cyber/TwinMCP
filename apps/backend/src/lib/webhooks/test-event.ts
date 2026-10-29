import { createDeliveries } from "./emit";
import { deliverWebhook, type DeliveryOutcome } from "./deliver";

/**
 * Send one "test" event to an endpoint right now and wait for the answer, so
 * the dashboard can show the status code. One attempt, no retry, and a failure
 * never counts toward auto-disable (deliver.ts). Works on a disabled endpoint
 * too, so the user can check it before turning it back on.
 */
export async function sendTestWebhook(
  endpointId: string
): Promise<{ deliveryId: string; outcome: DeliveryOutcome }> {
  const [deliveryId] = await createDeliveries([endpointId], "test", {
    message: "Test event from TwinMCP.",
  });
  if (!deliveryId) throw new Error("Test delivery was not created");
  const outcome = await deliverWebhook(deliveryId, { maxAttempts: 1 });
  return { deliveryId, outcome };
}
