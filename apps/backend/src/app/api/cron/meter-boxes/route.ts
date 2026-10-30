import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { runMeterBoxes } from "@/lib/wallet/compute-meter";
import { serverError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compute metering: diff each box's Upstash usage counters against its last
// snapshot and debit the owner's wallet (kind usage_compute). Schedule it
// every 5 minutes (Bearer CRON_SECRET), or trigger the "meter-boxes" QStash
// job. /api/health reports a blocker when it has not run for 15 minutes.
// Safe to re-run: each box's sample is claimed with a compare-and-swap, so
// overlapping runs never bill the same interval twice.

// Same dual auth as the other crons: Bearer CRON_SECRET (scheduled) or an
// admin session (manual run from the browser).
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
    const result = await runMeterBoxes();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/meter-boxes]", err);
    return serverError("Compute metering failed.");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
