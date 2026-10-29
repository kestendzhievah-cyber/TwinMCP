import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { runUpgradeNudges } from "@/lib/billing/nudge-job";
import { serverError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily Free → Pro nudge emails (offer + quota limit). Schedule it once a day
// (see TODO.md) or trigger the "upgrade-nudges" QStash job. `?dryRun=1` returns
// the decisions without sending anything — open it as an admin to check.

// Same dual auth as the digest/churn crons: Bearer CRON_SECRET (scheduled) or
// an admin session (manual test from the browser).
async function authorize(req: NextRequest): Promise<null | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return null;
  const admin = await requireAdmin(req);
  return admin instanceof NextResponse ? admin : null;
}

function wantsDryRun(req: NextRequest): boolean {
  const v = req.nextUrl.searchParams.get("dryRun");
  return v === "1" || v === "true";
}

async function run(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  const dryRun = wantsDryRun(req);
  try {
    const result = await runUpgradeNudges({ dryRun });
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        scanned: result.scanned,
        wouldSend: result.decisions.length,
        decisions: result.decisions,
      });
    }
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      sent: result.sent,
      errors: result.errors,
      ...(result.skipped ? { skipped: result.skipped } : {}),
      decisions: result.decisions.map((d) => ({ userId: d.userId, kind: d.kind })),
    });
  } catch (err) {
    console.error("[cron/nudges]", err);
    return serverError("Upgrade nudge job failed.");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
