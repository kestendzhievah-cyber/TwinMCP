import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/billing/checkout/start used to open a Pro subscription checkout
// (email-confirm callbacks, old pricing links). Subscriptions are retired, so
// every old link lands on Billing, where the wallet and top-ups live. Top-up
// links use GET /api/v2/wallet/topup/start?amount=… instead.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard/billing", req.url), 303);
}
