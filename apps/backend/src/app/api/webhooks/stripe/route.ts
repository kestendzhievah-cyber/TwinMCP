import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users, processedStripeEvents } from "@/db/schema";
import {
  getStripe,
  planActionForSubscription,
  cadenceFromPriceId,
  cadenceFromInterval,
  invoiceSubscriptionId,
  cancellationScheduled,
  cancellationReason,
  type Cadence,
} from "@/lib/stripe";
import { sendUpgradeConfirmationEmail } from "@/lib/email";
import { attributionMetadata } from "@/lib/billing/checkout-helpers";
import { audit } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";
import {
  applyCardSetupSession,
  applyChargeRefund,
  applyDisputeClosed,
  applyDisputeCreated,
  applyTopupSession,
  stripeId,
  walletPaymentIntentKind,
  walletSessionAction,
} from "@/lib/wallet/topup";
import { failAutoRecharge, settleAutoRecharge } from "@/lib/wallet/auto-recharge";
import type { Plan } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing model (since 2026-10-29): a prepaid wallet. Money comes in through
// one-off top-ups (Checkout, mode payment) and optional off-session
// auto-recharges; both are credited here, idempotently, keyed on Stripe ids.
// Subscriptions are no longer sold. The subscription handlers below stay only
// so existing subscribers keep a correct status mirror until the owner runs
// scripts/migrate-pro-to-wallet.ts, and they NEVER move a plan down: the
// wallet balance is the limit now, not the plan.

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Stripe 2026-03 dahlia moved current_period_end from the Subscription
  // to its items (subs can now have items on different billing schedules).
  // For our single-item subs, read from the first item.
  const ts = sub.items.data[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

async function findUserIdByCustomer(customerId: string): Promise<string | undefined> {
  // Resolve locally first — stripeCustomerId is stored (and uniquely indexed) on
  // the user row, so most billing events skip the Stripe round-trip entirely.
  // Fall back to Stripe's customer metadata for legacy rows written before the
  // id was persisted.
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (row) return row.id;
  const customer = await getStripe().customers.retrieve(customerId);
  if (customer.deleted) return undefined;
  return customer.metadata?.userId;
}

/**
 * Atomic jsonb merge of top-level keys into users.metadata, in one UPDATE, so
 * a concurrent writer (nudge job, preferences, onboarding) is never clobbered.
 */
function metadataMergeSql(top: Record<string, unknown>) {
  return sql`COALESCE(${users.metadata}, '{}'::jsonb) || ${JSON.stringify(top)}::jsonb`;
}

/**
 * First-touch attribution as analytics properties: the shared keys only
 * (lib/billing/checkout-helpers.ts), and the raw Google click id replaced by a
 * presence flag — PostHog needs to know an ad brought the user, not the id.
 */
function attributionProps(source: unknown): Record<string, string | boolean> {
  const meta = attributionMetadata(
    source && typeof source === "object" ? (source as Record<string, unknown>) : null
  );
  const { gclid, ...rest } = meta;
  return { ...rest, ...(gclid ? { gclid_present: true } : {}) };
}

function isCadence(value: unknown): value is Cadence {
  return value === "monthly" || value === "yearly";
}

/** The cadence a subscription bills at: our price ids first, then the price interval. */
function subscriptionCadence(sub: Stripe.Subscription): Cadence | null {
  const price = sub.items.data[0]?.price;
  return cadenceFromPriceId(price?.id) ?? cadenceFromInterval(price?.recurring?.interval);
}

/**
 * Idempotency guard. Returns true if the event has not been seen before
 * (and inserts it into processed_stripe_events). Returns false if Stripe
 * is retrying an event we already handled.
 */
async function shouldProcess(eventId: string, type: string): Promise<boolean> {
  try {
    const inserted = await getDb()
      .insert(processedStripeEvents)
      .values({ eventId, type })
      .onConflictDoNothing({ target: processedStripeEvents.eventId })
      .returning({ eventId: processedStripeEvents.eventId });
    return inserted.length > 0;
  } catch (err) {
    // Fail open: every money write below is ALSO idempotent on its own ledger
    // key (topup:<session>, autorecharge:<pi>, clawback:…), so processing a
    // duplicate cannot double-credit. Surface it so the team learns the guard
    // is degraded.
    console.error("[stripe webhook] idempotency check failed:", err);
    Sentry.captureException(err, { tags: { area: "billing", stage: "idempotency" } });
    return true;
  }
}

/**
 * Release a claim taken by shouldProcess() so a failed handler is retried by
 * Stripe instead of being deduped into a permanent no-op. Best-effort.
 */
async function releaseEvent(eventId: string): Promise<void> {
  await getDb().delete(processedStripeEvents).where(eq(processedStripeEvents.eventId, eventId));
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (!(await shouldProcess(event.id, event.type))) {
    // Already handled — respond 200 so Stripe stops retrying.
    return NextResponse.json({ received: true, deduped: true });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // A handler threw AFTER shouldProcess() claimed the event. Release the
    // claim (every handler is idempotent: ledger keys, set/upsert mirrors) and
    // 500 so Stripe retries and re-applies the side effects.
    console.error("[stripe webhook] handler failed:", err);
    Sentry.captureException(err, {
      tags: { area: "billing", stage: "handler", eventType: event.type },
    });
    await releaseEvent(event.id).catch((e) =>
      console.error("[stripe webhook] failed to release idempotency claim:", e)
    );
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** The user a charge / dispute belongs to, via its customer. */
async function userForCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): Promise<string | undefined> {
  const id = stripeId(customer);
  return id ? findUserIdByCustomer(id) : undefined;
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const action = walletSessionAction(session);
      if (action === "credit") await applyTopupSession(session, event.id);
      else if (action === "save_card" && event.type === "checkout.session.completed") {
        await applyCardSetupSession(session, event.id);
      } else if (action === "legacy" && event.type === "checkout.session.completed") {
        await handleLegacySubscriptionCheckout(session, event.id);
      }
      // await_payment: the async_payment_succeeded event credits it later.
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (session.metadata?.kind !== "wallet_topup" || !userId) break;
      audit({
        userId,
        action: "payment.failed",
        targetType: "none",
        targetId: session.id,
        metadata: { reason: "topup_async_payment_failed", stripeEvent: event.id },
      });
      break;
    }

    case "checkout.session.expired": {
      // Abandoned top-up: measured only. (The subscription recovery email is
      // retired with the subscriptions.)
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind !== "wallet_topup") break;
      trackServer({
        event: "checkout_expired",
        distinctId: session.metadata?.userId ?? "server",
        properties: {
          kind: "wallet_topup",
          amountEur: session.metadata?.amountEur ?? null,
          ...attributionProps(session.metadata),
        },
      });
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Checkout top-ups are credited from their session events; only the
      // off-session auto-recharge is settled here (idempotent on the PI id).
      if (walletPaymentIntentKind(pi) === "auto_recharge") await settleAutoRecharge(pi);
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (walletPaymentIntentKind(pi) !== "auto_recharge") break;
      const userId = pi.metadata?.userId;
      if (!userId) break;
      await failAutoRecharge(
        userId,
        pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? "payment_failed",
        pi.id
      );
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const userId = await userForCustomer(charge.customer);
      if (userId) await applyChargeRefund(userId, charge, event.id);
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const userId = await userIdForDispute(dispute);
      if (userId) await applyDisputeCreated(userId, dispute, event.id);
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const userId = await userIdForDispute(dispute);
      if (userId) await applyDisputeClosed(userId, dispute, event.id);
      break;
    }

    // ---- Legacy subscriptions (until scripts/migrate-pro-to-wallet.ts runs) ----

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      const update: Partial<typeof users.$inferInsert> = {
        subscriptionStatus: sub.status,
        currentPeriodEnd: periodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        stripeSubscriptionId: sub.id,
      };
      // Restore the paid plan on a live PAYING subscription; a dead one
      // (unpaid, canceled) only updates the status mirror — billing never
      // downgrades. A trial never restores: it has not paid, and plan='pro'
      // unlocks 50 servers and every box size on free credit.
      const action = planActionForSubscription({
        status: sub.status,
        metadataPlan: sub.metadata?.plan,
        priceId: sub.items.data[0]?.price?.id,
      });
      if (action.kind === "restore" && sub.status !== "trialing") update.plan = action.plan;
      await getDb().update(users).set(update).where(eq(users.id, userId));

      if (cancellationScheduled(event.data.previous_attributes, sub)) {
        const reason = cancellationReason(sub.cancellation_details, "cancel_at_period_end");
        audit({
          userId,
          action: "subscription.cancel_scheduled",
          targetType: "subscription",
          targetId: sub.id,
          metadata: {
            reason,
            status: sub.status,
            cancelAt: sub.cancel_at ?? null,
            stripeEvent: event.id,
          },
        });
        trackServer({
          event: "subscription_canceled",
          distinctId: userId,
          properties: {
            reason,
            stage: "scheduled",
            status: sub.status,
            cadence: subscriptionCadence(sub),
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      // The subscription ended (or was converted to wallet credit by the
      // owner's script). Mirror the status only: the plan is never downgraded
      // and no "you were downgraded" email goes out any more.
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      await getDb()
        .update(users)
        .set({
          subscriptionStatus: "canceled",
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
        })
        .where(eq(users.id, userId));

      const reason = cancellationReason(sub.cancellation_details, "subscription_deleted");
      audit({
        userId,
        action: "plan.cancel",
        targetType: "subscription",
        targetId: sub.id,
        metadata: { reason, stripeEvent: event.id, planKept: true },
      });
      trackServer({
        event: "subscription_canceled",
        distinctId: userId,
        properties: {
          reason,
          stage: "ended",
          converted: sub.metadata?.walletConversion === "true",
          cadence: subscriptionCadence(sub),
        },
      });
      break;
    }

    case "invoice.payment_failed": {
      // Legacy subscription renewal failed: audit only (Stripe keeps retrying,
      // and the plan is never downgraded by billing any more).
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = stripeId(invoice.customer);
      if (!customerId) break;
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;
      audit({
        userId,
        action: "payment.failed",
        targetType: "subscription",
        targetId: invoiceSubscriptionId(invoice),
        metadata: {
          reason: "invoice_payment_failed",
          amountDue: invoice.amount_due,
          attempt: invoice.attempt_count,
          stripeEvent: event.id,
        },
      });
      break;
    }
  }
}

async function userIdForDispute(dispute: Stripe.Dispute): Promise<string | undefined> {
  // The dispute object carries the charge (and its payment intent) but not
  // the customer: read the charge to find it.
  const chargeId = stripeId(dispute.charge);
  if (!chargeId) return undefined;
  const charge =
    typeof dispute.charge === "object" && dispute.charge
      ? dispute.charge
      : await getStripe().charges.retrieve(chargeId);
  return userForCustomer(charge.customer);
}

/**
 * A subscription checkout that completes after the switch to the wallet (a
 * session opened before the deploy). Mirrors it like before so the customer
 * gets what they paid for; the owner's conversion script then turns it into
 * credit. No trial bookkeeping (trials are retired).
 */
async function handleLegacySubscriptionCheckout(
  session: Stripe.Checkout.Session,
  eventId: string
): Promise<void> {
  const db = getDb();
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as Plan | undefined;
  if (!userId || (plan !== "pro" && plan !== "team")) return;
  const customerId = stripeId(session.customer);
  const subscriptionId = stripeId(session.subscription);
  const creatorSlug = session.metadata?.creatorSlug ?? null;
  const promotionCodeId = session.metadata?.promotionCodeId ?? null;

  const [previous] = await db
    .select({ plan: users.plan, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let currentPeriodEnd: Date | null = null;
  let cancelAtPeriodEnd = false;
  let subStatus = "active";
  const metaCadence = session.metadata?.cadence;
  let cadence: Cadence | null = isCadence(metaCadence) ? metaCadence : null;
  if (subscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = periodEnd(sub);
      cancelAtPeriodEnd = sub.cancel_at_period_end;
      subStatus = sub.status;
      cadence = subscriptionCadence(sub) ?? cadence;
    } catch (err) {
      console.error("[stripe webhook] retrieve subscription failed:", err);
    }
  }

  const promoPatch =
    creatorSlug || promotionCodeId
      ? {
          signupPromo: {
            creatorSlug,
            promotionCodeId,
            redeemedAt: new Date().toISOString(),
            stripeSessionId: session.id,
          },
        }
      : null;

  await db
    .update(users)
    .set({
      // Never a downgrade: a grandfathered Team account buying Pro stays Team.
      // A subscription that lands as `trialing` has paid nothing: it keeps
      // its plan (the wallet, not the plan, is what it runs on).
      ...(previous?.plan === "team" || subStatus === "trialing" ? {} : { plan }),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: subStatus,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      ...(promoPatch ? { metadata: metadataMergeSql(promoPatch) } : {}),
    })
    .where(eq(users.id, userId));

  audit({
    userId,
    action: "plan.upgrade",
    targetType: "subscription",
    targetId: subscriptionId,
    metadata: {
      from: previous?.plan ?? null,
      to: plan,
      cadence,
      legacy: true,
      stripeEvent: eventId,
      ...(creatorSlug ? { creatorSlug } : {}),
      ...(promotionCodeId ? { promotionCodeId } : {}),
    },
  });
  trackServer({
    event: "plan_upgraded",
    distinctId: userId,
    properties: { plan, previousPlan: previous?.plan ?? null, status: subStatus, legacy: true },
  });
  if (previous?.email) {
    sendUpgradeConfirmationEmail(previous.email, plan, {
      trialing: subStatus === "trialing",
      periodEnd: currentPeriodEnd,
    }).catch(() => {});
  }
  if (customerId) {
    await getStripe()
      .customers.update(customerId, { metadata: { userId } })
      .catch((err) => console.warn("[stripe webhook] customer metadata not set:", err));
  }
}
