import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { isEnforcementEnabled, runWalletEnforce } from "@/lib/wallet/compute-meter";
import { serverError } from "@/lib/errors";
import { retryDueAutoRecharges } from "@/lib/wallet/auto-recharge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wallet enforcement, every 5 minutes after /api/cron/meter-boxes (or the
// "wallet-enforce" QStash job):
//  - balance <= 0 → pause the user's running boxes (disk kept; wake is refused
//    until they top up). Funded accounts are paused, never deleted.
//  - promo-only account over the promo compute cost caps → pause + flag + audit.
//  - promo-only account, promo expired, balance <= 0 → warning emails on day
//    0, 7 and 13, runtime (box only) deleted on day 14; server configs kept.
// Pausing at zero and the promo kill switch always apply (safe, reversible:
// the disk is kept and a top-up resumes). The deletion warnings and the
// day-14 deletion run only when WALLET_ENFORCE_ENABLED=true. With ?dryRun=1
// it returns the decisions without writing, pausing, emailing or deleting.

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
    const r = await runWalletEnforce({ dryRun, destructive: isEnforcementEnabled() });
    // Auto-recharges a transient Stripe error left undone (enabled wallets
    // still below their threshold).
    const autoRechargeRetried = dryRun
      ? 0
      : await retryDueAutoRecharges().catch((err) => {
          console.error("[cron/wallet-enforce] auto-recharge retry failed:", err);
          return 0;
        });
    return NextResponse.json({
      ok: r.errors === 0,
      dryRun: r.dryRun,
      destructive: r.destructive,
      ...(r.destructive
        ? {}
        : {
            note: "WALLET_ENFORCE_ENABLED is not 'true': boxes are paused at zero, but no deletion warning is sent and no runtime is deleted",
          }),
      users: r.users,
      paused: r.paused,
      deleted: r.deleted,
      warnings: r.warnings,
      killSwitches: r.killSwitches,
      autoRechargeRetried,
      errors: r.errors,
      // Only users with something to do (ids, decisions, outcomes; no balances of others).
      actions: r.reports
        .filter(
          (u) =>
            u.decision.pauseServerIds.length > 0 ||
            u.decision.warning ||
            u.decision.deleteRuntimeServerIds.length > 0 ||
            u.decision.newKillSwitch ||
            u.errors.length > 0
        )
        .map((u) => ({
          userId: u.userId,
          funded: u.funded,
          totalMicros: u.totalMicros,
          pauseReason: u.decision.pauseReason,
          pause: u.decision.pauseServerIds,
          warning: u.decision.warning,
          deleteAt: u.decision.deleteAt?.toISOString() ?? null,
          delete: u.decision.deleteRuntimeServerIds,
          killSwitch: u.decision.newKillSwitch,
          paused: u.paused,
          deleted: u.deleted,
          errors: u.errors,
        })),
    });
  } catch (err) {
    console.error("[cron/wallet-enforce]", err);
    return serverError("Wallet enforcement failed.");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
