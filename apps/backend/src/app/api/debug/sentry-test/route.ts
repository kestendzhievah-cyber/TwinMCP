import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY Sentry verification route.
 *
 * Hit GET /api/debug/sentry-test?run=1 once, after SENTRY_DSN is set and the app
 * is redeployed. It sends a distinctive test error to Sentry and reports whether
 * the DSN is configured and whether the event flushed. Confirm the event lands
 * in your Sentry project and that the alert rule fires — then DELETE this route.
 */
export async function GET(req: Request) {
  const dsnConfigured = !!process.env.SENTRY_DSN;
  const armed = new URL(req.url).searchParams.get("run") === "1";

  if (!armed) {
    return NextResponse.json({
      ok: false,
      dsnConfigured,
      note: "Add ?run=1 to actually send a test error to Sentry.",
    });
  }

  const eventId = Sentry.captureException(
    new Error("TwinMCP Sentry verification — capture + alerts are wired")
  );
  const flushed = await Sentry.flush(2000);

  return NextResponse.json({
    ok: dsnConfigured && flushed,
    dsnConfigured,
    flushed,
    eventId,
    note: dsnConfigured
      ? "Check your Sentry project for this event, confirm the alert email, then delete this route."
      : "SENTRY_DSN is not set in this environment — nothing was sent. Set it and redeploy.",
  });
}
