import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEndpoints } from "@/db/schema/webhooks";
import { badRequest, forbidden, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import {
  checkWebhookTarget,
  createWebhookSchema,
  endpointColumns,
  serializeEndpoint,
  webhookWriteLimit,
} from "@/lib/webhooks/api";
import {
  MAX_ENDPOINTS_PER_USER,
  normalizeEvents,
  SUBSCRIBABLE_EVENTS,
  WEBHOOK_EVENT_LABELS,
} from "@/lib/webhooks/events";
import { generateWebhookSecret } from "@/lib/webhooks/sign";
import { encryptSecret } from "@/lib/webhooks/transport";
import { invalidateWebhookEndpointCache } from "@/lib/webhooks/emit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Outbound webhooks (all plans). The signing secret is returned ONCE, by POST.

export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  try {
    const rows = await getDb()
      .select(endpointColumns)
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, session.userId))
      .orderBy(desc(webhookEndpoints.createdAt));
    return NextResponse.json({
      endpoints: rows.map(serializeEndpoint),
      events: SUBSCRIBABLE_EVENTS.map((type) => ({ type, ...WEBHOOK_EVENT_LABELS[type] })),
      limit: MAX_ENDPOINTS_PER_USER,
    });
  } catch (err) {
    console.error("[webhooks GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  const limited = await webhookWriteLimit(session.userId, "webhook_write");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

  const target = await checkWebhookTarget(parsed.data.url);
  if (!target.ok) return badRequest(target.reason);

  try {
    const db = getDb();
    const [tally] = await db
      .select({ n: count() })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, session.userId));
    if ((tally?.n ?? 0) >= MAX_ENDPOINTS_PER_USER) {
      return forbidden(
        `You can have up to ${MAX_ENDPOINTS_PER_USER} webhook endpoints. Delete one to add another.`
      );
    }

    const secret = generateWebhookSecret();
    const [row] = await db
      .insert(webhookEndpoints)
      .values({
        id: randomUUID(),
        userId: session.userId,
        url: target.url,
        secretEncrypted: encryptSecret(secret),
        events: normalizeEvents(parsed.data.events),
      })
      .returning(endpointColumns);
    invalidateWebhookEndpointCache(session.userId);
    if (!row) return serverError();
    return NextResponse.json({ endpoint: serializeEndpoint(row), secret }, { status: 201 });
  } catch (err) {
    console.error("[webhooks POST]", err);
    return serverError();
  }
}
