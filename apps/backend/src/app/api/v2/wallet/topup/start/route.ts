import { type NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/session";
import { returnOrigin } from "@/lib/billing/origin";
import { ATTRIBUTION_KEYS } from "@/lib/analytics/attribution";
import { createTopupCheckout, parseTopupAmount } from "@/lib/wallet/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/wallet/topup/start?amount=25
//
// A plain navigation that opens a top-up Checkout (303 to Stripe), for links
// in emails ("top up €25") and on marketing pages. Same rules as
// POST /api/v2/wallet/topup (lib/wallet/topup.ts).
//
// CSRF: this GET creates a Stripe session, so it only does so for a navigation
// the browser marks as same-origin / same-site / user-initiated ("none"). A
// cross-site request (an <img> on another site, a webmail redirect chain) is
// bounced to Billing with the amount pre-selected, where the user confirms
// with a same-origin POST.
const TRUSTED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

function billing(url: URL, params?: Record<string, string>): NextResponse {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  return NextResponse.redirect(new URL(`/dashboard/billing${q}`, url.origin), 303);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const amount = parseTopupAmount(url.searchParams.get("amount") ?? "");
  if (!amount.ok) return billing(url);
  const amountParam = { amount: String(amount.amountEur) };

  const session = await requireSessionUser(req);
  if (!session) {
    const resume = `/dashboard/billing?${new URLSearchParams(amountParam).toString()}`;
    return NextResponse.redirect(
      new URL(`/sign-in?returnTo=${encodeURIComponent(resume)}`, url.origin),
      303
    );
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !TRUSTED_FETCH_SITES.has(fetchSite)) return billing(url, amountParam);

  // Attribution present on this URL (an email or campaign link); the stored
  // sign-up copy is the default inside createTopupCheckout.
  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = url.searchParams.get(key);
    if (value) attribution[key] = value;
  }

  const result = await createTopupCheckout({
    userId: session.userId,
    email: session.email ?? null,
    amountEur: amount.amountEur,
    origin: returnOrigin(req),
    attribution: Object.keys(attribution).length > 0 ? attribution : null,
  });
  if (result.kind === "error") {
    // A fixed reason code, never the server's text, so the URL cannot carry
    // injected content.
    return billing(url, { topup: "error", reason: result.reason });
  }
  return NextResponse.redirect(result.url, 303);
}
