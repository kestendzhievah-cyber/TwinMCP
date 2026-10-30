import { type NextRequest, NextResponse } from "next/server";
import { adminEmails } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { serverError } from "@/lib/errors";
import { runChurnAlerts } from "@/lib/scheduler/churn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same dual auth as the digest: Bearer CRON_SECRET (scheduled) or an admin
// session (manual test).
async function authorize(req: NextRequest): Promise<null | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return null;
  const admin = await requireAdmin(req);
  return admin instanceof NextResponse ? admin : null;
}

async function run(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  try {
    // One implementation for this route and the in-process scheduler
    // (lib/scheduler/churn.ts). Without a recipient nothing is sent and no
    // client is marked as alerted, so the next run with a recipient still
    // reports them.
    const to = process.env.DIGEST_EMAIL ?? adminEmails()[0];
    if (!to) return NextResponse.json({ alerted: 0, skipped: "no recipient", sentTo: null });
    const r = await runChurnAlerts(to);
    return NextResponse.json({ ...r, sentTo: to });
  } catch (err) {
    console.error("[churn]", err);
    return serverError("Échec de la détection churn.");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
