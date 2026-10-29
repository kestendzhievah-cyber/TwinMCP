import { desc, eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema/webhooks";
import {
  deliveryColumns,
  endpointColumns,
  serializeDelivery,
  serializeEndpoint,
  type PublicWebhookDelivery,
  type PublicWebhookEndpoint,
} from "@/lib/webhooks/api";
import { WebhooksPanel } from "./panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Webhooks" };

const RECENT_DELIVERIES = 50;

export default async function WebhooksSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  let endpoints: PublicWebhookEndpoint[] = [];
  let deliveries: (PublicWebhookDelivery & { endpointId: string })[] = [];
  let loadFailed = false;
  try {
    const [endpointRows, deliveryRows] = await Promise.all([
      db
        .select(endpointColumns)
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.userId, user.id))
        .orderBy(desc(webhookEndpoints.createdAt)),
      db
        .select(deliveryColumns)
        .from(webhookDeliveries)
        .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
        .where(eq(webhookEndpoints.userId, user.id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(RECENT_DELIVERIES),
    ]);
    endpoints = endpointRows.map(serializeEndpoint);
    deliveries = deliveryRows.map((d) => ({ ...serializeDelivery(d), endpointId: d.endpointId }));
  } catch (err) {
    // The tables may not be migrated yet: show the page, not a 500.
    console.warn("[dashboard/webhooks] load failed:", err);
    loadFailed = true;
  }

  return <WebhooksPanel endpoints={endpoints} deliveries={deliveries} loadFailed={loadFailed} />;
}
