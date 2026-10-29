import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { returnOrigin } from "@/lib/billing/origin";
import { createProCheckout } from "@/lib/billing/checkout";
import { badRequest, jsonError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only Pro is sold. "team" is still parsed (old links / clients may send it) so
// we can answer with a clear 400 below instead of a raw validation error. Team is
// grandfathered: existing subscribers manage it from the billing portal.
const schema = z.object({
  plan: z.enum(["pro", "team"]),
  cadence: z.enum(["monthly", "yearly"]).default("monthly"),
  // Stripe promotion_code id (promo_xxx). When provided, pre-applies the
  // discount in checkout so the user doesn't have to type the code.
  promotionCodeId: z
    .string()
    .regex(/^promo_[A-Za-z0-9]+$/)
    .optional(),
  // Free-form attribution slug from the creator landing page (e.g. "youtuber").
  // Surfaces in subscription metadata for ROI tracking.
  creatorSlug: z.string().min(1).max(64).optional(),
  // The surface that opened the checkout: decides where Stripe sends the user
  // back (lib/billing/checkout.ts checkoutReturnUrls). Defaults to Billing.
  from: z.enum(["billing", "onboarding", "pricing", "signup"]).optional(),
});

// Thin wrapper over lib/billing/checkout.ts createProCheckout, which owns every
// money-path rule (portal for subscribers, first-subscription trial, promo
// exclusivity, tax, return URLs, attribution metadata).
export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);
  if (parsed.data.plan !== "pro") return badRequest("This plan is no longer available");

  const result = await createProCheckout({
    userId: session.userId,
    email: session.email ?? null,
    cadence: parsed.data.cadence,
    promotionCodeId: parsed.data.promotionCodeId,
    creatorSlug: parsed.data.creatorSlug,
    from: parsed.data.from ?? "billing",
    origin: returnOrigin(req),
  });

  if (result.kind === "error") return jsonError(result.status, result.message);
  return NextResponse.json({ url: result.url, kind: result.kind });
}
