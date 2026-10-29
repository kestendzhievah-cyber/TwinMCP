import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEndpoints } from "@/db/schema/webhooks";
import { notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { webhookWriteLimit } from "@/lib/webhooks/api";
import { sendTestWebhook } from "@/lib/webhooks/test-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send a signed "test" event to the endpoint now and report what came back.
 * One attempt (at most the 10 s delivery timeout), no retry; a failed test
 * does not count toward auto-disable.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const limited = await webhookWriteLimit(session.userId, "webhook_test");
  if (limited) return limited;

  try {
    const [endpoint] = await getDb()
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, session.userId)))
      .limit(1);
    if (!endpoint) return notFound("Webhook endpoint not found");

    const { deliveryId, outcome } = await sendTestWebhook(endpoint.id);
    if (outcome.status === "skipped") return serverError("The test event could not be sent.");
    return NextResponse.json({
      deliveryId,
      ok: outcome.status === "success",
      responseCode: outcome.responseCode,
      error: outcome.status === "success" ? null : outcome.error,
    });
  } catch (err) {
    console.error("[webhooks/:id/test POST]", err);
    return serverError();
  }
}
