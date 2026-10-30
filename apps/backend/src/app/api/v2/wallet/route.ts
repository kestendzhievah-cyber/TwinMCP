import { type NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { getWallet } from "@/lib/wallet/ledger";
import { publicPriceTable } from "@/lib/wallet/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/wallet: the signed-in user's prepaid balance (integer
// micro-euros) and the public price list. A read failure is a 500, never a
// zero balance.
export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const w = await getWallet(session.userId);
    return NextResponse.json(
      {
        paidMicros: w.paidMicros,
        promoMicros: w.promoMicros,
        promoExpiresAt: w.promoExpiresAt?.toISOString() ?? null,
        promoExpired: w.promoExpired,
        totalMicros: w.totalMicros,
        funded: w.funded,
        autoRecharge: w.autoRecharge,
        pricing: publicPriceTable(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[wallet] balance read failed", err);
    return serverError("Could not load your balance.");
  }
}
