import { createHash, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { serverError } from "@/lib/errors";
import { expirePromos, promosExpiringBetween } from "@/lib/wallet/ledger";
import { notifyWallet } from "@/lib/wallet/after-debit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Promotional credit expiry. Run it at least daily (POST or GET with
// Authorization: Bearer <CRON_SECRET>); hourly is better, since an expired
// promo already stops counting toward the balance and this only writes it off.
//   1. Writes off every promo balance past its expiry (promo_expiry ledger
//      rows). Batched: `truncated: true` means the next run continues.
//   2. Sends the 7-day and 2-day reminders for live promo balances
//      (notify.ts dedups, so repeated runs send each one once).
//
// Auth: Bearer CRON_SECRET (constant-time compare) on POST or GET; an admin
// session on POST only (a state-changing GET with cookie auth could be
// triggered by any link).

const DAY_MS = 86_400_000;

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function hasCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function run() {
  try {
    const now = new Date();
    const result = await expirePromos(now);

    const in2d = new Date(now.getTime() + 2 * DAY_MS);
    const in7d = new Date(now.getTime() + 7 * DAY_MS);
    const [soon, week] = await Promise.all([
      promosExpiringBetween(now, in2d),
      promosExpiringBetween(in2d, in7d),
    ]);
    for (const p of soon) {
      notifyWallet(p.userId, "promo_expiring_2d", {
        promoMicros: p.promoMicros,
        promoExpiresAt: p.promoExpiresAt.toISOString(),
      });
    }
    for (const p of week) {
      notifyWallet(p.userId, "promo_expiring_7d", {
        promoMicros: p.promoMicros,
        promoExpiresAt: p.promoExpiresAt.toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      ...result,
      reminders: { expiring2d: soon.length, expiring7d: week.length },
    });
  } catch (err) {
    console.error("[cron/wallet-expiry]", err);
    return serverError("Wallet expiry run failed.");
  }
}

export async function POST(req: NextRequest) {
  if (!hasCronSecret(req)) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
  }
  return run();
}

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req)) {
    return NextResponse.json(
      { message: "Bearer CRON_SECRET required (admins: use POST)." },
      { status: 401 }
    );
  }
  return run();
}
