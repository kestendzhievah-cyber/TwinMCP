import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema/webhooks";
import { badRequest, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import {
  checkWebhookTarget,
  deliveryColumns,
  endpointColumns,
  serializeDelivery,
  serializeEndpoint,
  updateWebhookSchema,
  webhookWriteLimit,
} from "@/lib/webhooks/api";
import { normalizeEvents } from "@/lib/webhooks/events";
import { invalidateWebhookEndpointCache } from "@/lib/webhooks/emit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_DELIVERIES = 25;

type Params = { params: Promise<{ id: string }> };

function ownEndpoint(userId: string, id: string) {
  return and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId));
}

/** The endpoint and its most recent deliveries (no payloads). */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  try {
    const db = getDb();
    const [row] = await db
      .select(endpointColumns)
      .from(webhookEndpoints)
      .where(ownEndpoint(session.userId, id))
      .limit(1);
    if (!row) return notFound("Webhook endpoint not found");
    const deliveries = await db
      .select(deliveryColumns)
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(RECENT_DELIVERIES);
    return NextResponse.json({
      endpoint: serializeEndpoint(row),
      deliveries: deliveries.map(serializeDelivery),
    });
  } catch (err) {
    console.error("[webhooks/:id GET]", err);
    return serverError();
  }
}

/** Change the URL, the events, or turn the endpoint on/off (on resets the failure streak). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const limited = await webhookWriteLimit(session.userId, "webhook_write");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

  const set: Partial<typeof webhookEndpoints.$inferInsert> = {};
  if (parsed.data.url !== undefined) {
    const target = await checkWebhookTarget(parsed.data.url);
    if (!target.ok) return badRequest(target.reason);
    set.url = target.url;
  }
  if (parsed.data.events !== undefined) set.events = normalizeEvents(parsed.data.events);
  if (parsed.data.active !== undefined) {
    set.active = parsed.data.active;
    if (parsed.data.active) set.failureCount = 0;
  }

  try {
    const [row] = await getDb()
      .update(webhookEndpoints)
      .set(set)
      .where(ownEndpoint(session.userId, id))
      .returning(endpointColumns);
    if (!row) return notFound("Webhook endpoint not found");
    invalidateWebhookEndpointCache(session.userId);
    return NextResponse.json({ endpoint: serializeEndpoint(row) });
  } catch (err) {
    console.error("[webhooks/:id PATCH]", err);
    return serverError();
  }
}

/** Delete the endpoint and its delivery history (cascade). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const limited = await webhookWriteLimit(session.userId, "webhook_write");
  if (limited) return limited;

  try {
    const deleted = await getDb()
      .delete(webhookEndpoints)
      .where(ownEndpoint(session.userId, id))
      .returning({ id: webhookEndpoints.id });
    if (deleted.length === 0) return notFound("Webhook endpoint not found");
    invalidateWebhookEndpointCache(session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhooks/:id DELETE]", err);
    return serverError();
  }
}
