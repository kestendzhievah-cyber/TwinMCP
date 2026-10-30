import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { runWalletReminders } from "@/lib/billing/nudge-job";
import { expirePromos } from "@/lib/wallet/ledger";
import { serverError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily wallet reminders (lib/billing/nudge-job.ts runWalletReminders): free
// credit expiring in 7 days and in 2 days, low/zero balance catch-ups, and the
// runtime deletion warnings of accounts without paid credit. Every email goes
// through lib/wallet/notify.ts, which dedupes it in wallet_accounts.notified,
// so running this twice a day sends nothing twice.
//
// Before the reminders, promo credit past its expiry is written off
// (lib/wallet/ledger.ts expirePromos, batched, safe to re-run); `?expire=0`
// skips that step. `?dryRun=1` returns the decisions without sending or
// expiring anything — open it as an admin to check.
//
// Schedule it once a day (e.g. 08:00 UTC) with `Authorization: Bearer $CRON_SECRET`.

// Same dual auth as the other crons: Bearer CRON_SECRET (scheduled) or an
// admin session (manual test from the browser).
async function authorize(req: NextRequest): Promise<null | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return null;
  const admin = await requireAdmin(req);
  return admin instanceof NextResponse ? admin : null;
}

function flag(req: NextRequest, name: string): string | null {
  return req.nextUrl.searchParams.get(name);
}

async function run(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  const dryRun = flag(req, "dryRun") === "1" || flag(req, "dryRun") === "true";
  const expire = !dryRun && flag(req, "expire") !== "0";
  try {
    let expired: Awaited<ReturnType<typeof expirePromos>> | { error: string } | null = null;
    if (expire) {
      // A failed write-off must not cost the reminders: report it and go on.
      expired = await expirePromos(new Date()).catch((err: unknown) => {
        console.error("[cron/wallet-reminders] expirePromos", err);
        return { error: "expirePromos failed" };
      });
    }
    const result = await runWalletReminders({ dryRun });
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
      expired,
      scanned: result.scanned,
      sent: result.sent,
      dropped: result.dropped,
      errors: result.errors,
      ...(result.skipped ? { skipped: result.skipped } : {}),
      decisions: result.decisions.map((d) => ({ userId: d.userId, kind: d.kind })),
    });
  } catch (err) {
    console.error("[cron/wallet-reminders]", err);
    return serverError("Wallet reminder job failed.");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
