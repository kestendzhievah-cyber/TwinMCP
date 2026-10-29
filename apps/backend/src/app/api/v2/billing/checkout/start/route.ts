import { type NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/session";
import { returnOrigin } from "@/lib/billing/origin";
import { createProCheckout, isCheckoutFrom } from "@/lib/billing/checkout";
import { normalizeCadence, normalizePromo, proIntentQuery } from "@/lib/auth/post-auth";
import { ATTRIBUTION_KEYS } from "@/lib/analytics/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/billing/checkout/start?plan=pro&cadence=monthly|yearly&promo=…&from=…
//
// A plain navigation that opens Stripe Checkout (303 to the Stripe URL, or to
// the Customer Portal for an account that is already subscribed). Used where a
// fetch + JSON round trip is not possible: the auth callbacks after an email
// confirmation carrying a Pro intent. Same rules as POST /api/v2/billing/checkout
// (lib/billing/checkout.ts). Only Pro is sold: anything but plan=pro (or the
// retired plan=team alias, which signs up for Pro) goes to Billing.
//
// CSRF: this GET creates a Stripe session, so it only does so for a navigation
// the browser marks as same-origin / same-site / user-initiated ("none"). A
// cross-site request (an <img> or link on another site, but also a webmail
// redirect chain) is bounced to Billing, which re-opens the checkout itself
// with a same-origin POST, visibly, for a Free account only.
const TRUSTED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan");
  if (plan !== "pro" && plan !== "team") {
    return NextResponse.redirect(new URL("/dashboard/billing", url.origin), 303);
  }
  const cadence = normalizeCadence(url.searchParams.get("cadence"));
  const promo = normalizePromo(url.searchParams.get("promo"));
  const fromParam = url.searchParams.get("from");
  const from = isCheckoutFrom(fromParam) ? fromParam : "billing";

  const session = await requireSessionUser(req);
  if (!session) {
    // Sign in first, then land on Billing, which resumes the checkout itself.
    const resume = `/dashboard/billing?${proIntentQuery({ cadence, ...(promo ? { promo } : {}) })}`;
    return NextResponse.redirect(
      new URL(`/sign-in?returnTo=${encodeURIComponent(resume)}`, url.origin),
      303
    );
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !TRUSTED_FETCH_SITES.has(fetchSite)) {
    const q = new URLSearchParams(proIntentQuery({ cadence, ...(promo ? { promo } : {}) }));
    q.set("from", from);
    return NextResponse.redirect(new URL(`/dashboard/billing?${q.toString()}`, url.origin), 303);
  }

  // First-touch attribution present on this URL (rare: the stored sign-up copy
  // in users.metadata.attribution is the default inside createProCheckout).
  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = url.searchParams.get(key);
    if (value) attribution[key] = value;
  }

  const result = await createProCheckout({
    userId: session.userId,
    email: session.email ?? null,
    cadence,
    ...(promo?.startsWith("promo_") ? { promotionCodeId: promo } : {}),
    ...(promo && !promo.startsWith("promo_") ? { creatorSlug: promo } : {}),
    from,
    origin: returnOrigin(req),
    attribution: Object.keys(attribution).length > 0 ? attribution : null,
  });

  if (result.kind === "error") {
    // A fixed reason code, never the server's text: the billing page maps it
    // to its own copy, so this URL cannot carry injected content.
    const q = new URLSearchParams({ checkout: "error", reason: result.reason });
    return NextResponse.redirect(new URL(`/dashboard/billing?${q.toString()}`, url.origin), 303);
  }
  return NextResponse.redirect(result.url, 303);
}
