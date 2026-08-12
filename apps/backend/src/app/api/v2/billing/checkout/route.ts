import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getStripe, getPriceId, TRIAL_DAYS, TAX_ENABLED } from "@/lib/stripe";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { getCreator } from "@/lib/promos/creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
});

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const priceId = getPriceId(parsed.data.plan, parsed.data.cadence);
  if (!priceId) return badRequest("Stripe price not configured for this plan/cadence");

  // If only a creatorSlug was provided, resolve to its promotion_code id.
  // This keeps the client API tiny — sign-up just persists the slug.
  let resolvedPromoId = parsed.data.promotionCodeId;
  if (!resolvedPromoId && parsed.data.creatorSlug) {
    const creator = getCreator(parsed.data.creatorSlug);
    if (creator && creator.plan === parsed.data.plan && creator.cadence === parsed.data.cadence) {
      resolvedPromoId = creator.promotionCodeId;
    }
    // If the creator exists but the plan/cadence don't match, drop the promo
    // silently — the user still gets to check out, just at full price.
  }

  try {
    const db = getDb();
    const [userRow] = await db
      .select({ email: users.email, stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const origin = req.headers.get("origin") ?? "https://twinmcp.fr";
    const stripe = getStripe();

    // Reuse an existing Stripe customer if we already linked one — avoids
    // duplicate customers across upgrades and keeps Customer Portal happy.
    // customer + customer_email are mutually exclusive; we pick one.
    const customerArgs = userRow?.stripeCustomerId
      ? { customer: userRow.stripeCustomerId }
      : { customer_email: userRow?.email };

    // Pre-applying a discount and allowing the promo input are mutually
    // exclusive in Stripe — pick one based on whether we have a code to apply.
    const hasPreApplied = !!resolvedPromoId;
    const promoMetadata: Record<string, string> = {};
    if (parsed.data.creatorSlug) {
      promoMetadata.creatorSlug = parsed.data.creatorSlug;
      promoMetadata.promotionCodeId = resolvedPromoId ?? "";
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...customerArgs,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: session.userId,
        plan: parsed.data.plan,
        cadence: parsed.data.cadence,
        ...promoMetadata,
      },
      subscription_data: {
        metadata: {
          userId: session.userId,
          plan: parsed.data.plan,
          cadence: parsed.data.cadence,
          ...promoMetadata,
        },
        ...(TRIAL_DAYS > 0 ? { trial_period_days: TRIAL_DAYS } : {}),
      },
      ...(hasPreApplied
        ? { discounts: [{ promotion_code: resolvedPromoId! }] }
        : { allow_promotion_codes: true }),
      ...(TAX_ENABLED
        ? {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            // Stripe requires an address on file to compute tax for a *provided*
            // customer; customer_update (valid only with `customer`, not
            // `customer_email`) lets Checkout capture + persist it. Without this,
            // automatic_tax rejects the session for every returning customer.
            ...(userRow?.stripeCustomerId ? { customer_update: { address: "auto" as const } } : {}),
          }
        : {}),
      billing_address_collection: "auto",
      success_url: `${origin}/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plans?status=canceled`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return serverError();
  }
}
