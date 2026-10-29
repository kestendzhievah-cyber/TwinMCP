// The one way to open a Pro checkout. Shared by POST /api/v2/billing/checkout
// (fetch from the dashboard, the pricing page and the onboarding wizard) and by
// GET /api/v2/billing/checkout/start (a plain navigation: the email-confirm
// callback and the billing page's "plan=pro" auto-start redirect through it).
//
// Behaviour the money path depends on, kept from the original route:
//   - an account with an active, trialing or past-due subscription gets the
//     Customer Portal, never a second subscription;
//   - the free month is for a FIRST subscription only (no Stripe customer yet)
//     and never stacks with a pre-applied creator promo;
//   - the card is collected up front, promo codes are redeemable unless one was
//     pre-applied, Stripe Tax settings follow TAX_ENABLED.

import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getStripe, getPriceId, TRIAL_DAYS, TAX_ENABLED, type Cadence } from "@/lib/stripe";
import { getCreator } from "@/lib/promos/creators";
import {
  attributionMetadata,
  checkoutReturnUrls,
  type CheckoutErrorReason,
  type CheckoutFrom,
} from "@/lib/billing/checkout-helpers";

export {
  CHECKOUT_FROMS,
  attributionMetadata,
  checkoutReturnUrls,
  isCheckoutErrorReason,
  isCheckoutFrom,
} from "@/lib/billing/checkout-helpers";
export type { CheckoutErrorReason, CheckoutFrom } from "@/lib/billing/checkout-helpers";

export type CheckoutResult =
  | { kind: "checkout" | "portal"; url: string }
  | { kind: "error"; status: number; message: string; reason: CheckoutErrorReason };

export interface CreateProCheckoutInput {
  userId: string;
  /** Session email, used when the users row has no deliverable address yet. */
  email: string | null;
  cadence: Cadence;
  /** Stripe promotion_code id (promo_…): pre-applies the discount in Checkout. */
  promotionCodeId?: string;
  /** Creator landing slug (lib/promos/creators.ts): resolves to its promo id. */
  creatorSlug?: string;
  from: CheckoutFrom;
  /** Public origin for the success / cancel URLs (lib/billing/origin.ts). */
  origin: string;
  /**
   * Attribution to carry into the Stripe metadata, merged over the
   * users.metadata.attribution copy made at sign-up (explicit keys win).
   */
  attribution?: Record<string, string> | null;
}

// Subscribed = the portal, not a new checkout. canceled / incomplete fall
// through to a normal checkout.
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

const PLACEHOLDER_EMAIL = /@placeholder\.twinmcp\.fr$/;

export async function createProCheckout(input: CreateProCheckoutInput): Promise<CheckoutResult> {
  const priceId = getPriceId("pro", input.cadence);
  if (!priceId) {
    return {
      kind: "error",
      status: 400,
      message: "Stripe price not configured for this plan/cadence",
      reason: "price",
    };
  }

  // If only a creatorSlug was provided, resolve to its promotion_code id. This
  // keeps the client API tiny — sign-up just persists the slug. A creator whose
  // plan/cadence don't match drops the promo silently: the user still checks
  // out, at full price.
  let resolvedPromoId = input.promotionCodeId;
  if (!resolvedPromoId && input.creatorSlug) {
    const creator = getCreator(input.creatorSlug);
    if (creator && creator.plan === "pro" && creator.cadence === input.cadence) {
      resolvedPromoId = creator.promotionCodeId || undefined;
    }
  }

  try {
    const [userRow] = await getDb()
      .select({
        email: users.email,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionStatus: users.subscriptionStatus,
        metadata: users.metadata,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    const stripe = getStripe();
    const origin = input.origin.replace(/\/$/, "");

    // Already subscribed → Customer Portal to switch/manage instead of a fresh
    // Checkout, which would create a SECOND subscription and double-bill.
    if (
      userRow?.stripeCustomerId &&
      userRow.stripeSubscriptionId &&
      ACTIVE_STATUSES.includes(userRow.subscriptionStatus ?? "")
    ) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: userRow.stripeCustomerId,
        return_url: `${origin}/dashboard/billing`,
      });
      return { kind: "portal", url: portal.url };
    }

    // Reuse an existing Stripe customer if we already linked one — avoids
    // duplicate customers across upgrades and keeps Customer Portal happy.
    // customer + customer_email are mutually exclusive; we pick one.
    const rowEmail =
      userRow?.email && !PLACEHOLDER_EMAIL.test(userRow.email) ? userRow.email : null;
    const customerArgs = userRow?.stripeCustomerId
      ? { customer: userRow.stripeCustomerId }
      : { customer_email: rowEmail ?? input.email ?? undefined };

    // Pre-applying a discount and allowing the promo input are mutually
    // exclusive in Stripe — pick one based on whether we have a code to apply.
    const hasPreApplied = !!resolvedPromoId;
    const promoMetadata: Record<string, string> = {};
    if (input.creatorSlug) {
      promoMetadata.creatorSlug = input.creatorSlug;
      promoMetadata.promotionCodeId = resolvedPromoId ?? "";
    }

    // The free month is for a FIRST subscription only: a Stripe customer exists
    // once someone has subscribed, so returning customers pay from day one. A
    // pre-applied creator promo already gives free months, so they don't stack.
    const grantTrial = TRIAL_DAYS > 0 && !userRow?.stripeCustomerId && !hasPreApplied;

    const storedAttribution = (userRow?.metadata as Record<string, unknown> | null)?.attribution;
    const metadata: Record<string, string> = {
      userId: input.userId,
      plan: "pro",
      cadence: input.cadence,
      from: input.from,
      ...promoMetadata,
      // Stored first-touch copy (sign-up), overridden key by key by anything
      // the caller passes explicitly.
      ...attributionMetadata({
        ...((storedAttribution as Record<string, unknown> | undefined) ?? {}),
        ...(input.attribution ?? {}),
      }),
    };

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Card collected up front, even during the trial.
      payment_method_collection: "always",
      ...customerArgs,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: {
        metadata,
        ...(grantTrial
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
            }
          : {}),
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
      // An abandoned session gets a recovery URL (Stripe's checkout.session.expired
      // event) so an "you left your free month" email can bring the user back.
      // Promo codes stay redeemable on the recovered session unless one was
      // pre-applied, mirroring the exclusivity of the session itself.
      after_expiration: {
        recovery: { enabled: true, allow_promotion_codes: !hasPreApplied },
      },
      ...checkoutReturnUrls(origin, input.from),
    });

    if (!checkout.url) {
      return {
        kind: "error",
        status: 500,
        message: "Stripe did not return a checkout URL",
        reason: "stripe",
      };
    }
    return { kind: "checkout", url: checkout.url };
  } catch (err) {
    console.error("[billing/checkout]", err);
    Sentry.captureException(err, {
      tags: { area: "billing", stage: "checkout" },
      extra: { userId: input.userId, cadence: input.cadence, from: input.from },
    });
    return {
      kind: "error",
      status: 500,
      message: "Could not start checkout. Please try again.",
      reason: "stripe",
    };
  }
}
