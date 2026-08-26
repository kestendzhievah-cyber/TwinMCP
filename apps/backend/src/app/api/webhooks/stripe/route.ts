import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users, processedStripeEvents } from "@/db/schema";
import { getStripe, planActionForSubscription } from "@/lib/stripe";
import { sendUpgradeConfirmationEmail, sendPlanDowngradeEmail } from "@/lib/email";
import { reconcileServersForPlan } from "@/lib/billing/reconcile";
import { audit } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";
import type { Plan } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const customer = (await getStripe().customers.retrieve(customerId)) as Stripe.Customer;
  return customer.metadata?.userId;
}

/** Best-effort downgrade notification to the user's real email. */
async function notifyDowngrade(userId: string, reason: string): Promise<void> {
  try {
    const [u] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (u?.email && !u.email.endsWith("@placeholder.twinmcp.fr")) {
      await sendPlanDowngradeEmail(u.email, reason);
    }
  } catch (err) {
    console.error("[stripe webhook] downgrade notify failed:", err);
  }
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
    // Fail open: if the idempotency table breaks, we'd rather double-bill
    // an audit log than refuse to handle the event. Surface it so the team
    // learns the guard is degraded rather than discovering it via double-sends.
    console.error("[stripe webhook] idempotency check failed:", err);
    Sentry.captureException(err, { tags: { area: "billing", stage: "idempotency" } });
    return true;
  }
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

  const db = getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as Plan | undefined;
      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);

      const creatorSlug = session.metadata?.creatorSlug ?? null;
      const promotionCodeId = session.metadata?.promotionCodeId ?? null;

      if (userId && plan) {
        const [previous] = await db
          .select({ plan: users.plan, email: users.email, metadata: users.metadata })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        // Merge promo attribution into the existing metadata blob so we don't
        // clobber comp flags or any other fields callers stash there.
        const nextMetadata =
          creatorSlug || promotionCodeId
            ? {
                ...((previous?.metadata ?? {}) as Record<string, unknown>),
                signupPromo: {
                  creatorSlug,
                  promotionCodeId,
                  redeemedAt: new Date().toISOString(),
                  stripeSessionId: session.id,
                },
              }
            : undefined;

        // Period fields aren't on the checkout session — pull them from the
        // subscription so the billing UI is correct immediately after purchase.
        let currentPeriodEnd: Date | null = null;
        let cancelAtPeriodEnd = false;
        if (subscriptionId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subscriptionId);
            currentPeriodEnd = periodEnd(sub);
            cancelAtPeriodEnd = sub.cancel_at_period_end;
          } catch (err) {
            console.error("[stripe webhook] retrieve subscription failed:", err);
          }
        }

        await db
          .update(users)
          .set({
            plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active",
            currentPeriodEnd,
            cancelAtPeriodEnd,
            ...(nextMetadata ? { metadata: nextMetadata } : {}),
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
            stripeEvent: event.id,
            ...(creatorSlug ? { creatorSlug } : {}),
            ...(promotionCodeId ? { promotionCodeId } : {}),
          },
        });

        if (creatorSlug) {
          trackServer({
            event: "promo_redeemed",
            distinctId: userId,
            properties: { creatorSlug, promotionCodeId, plan },
          });
        }

        if (previous?.email) {
          sendUpgradeConfirmationEmail(previous.email, plan).catch(() => {});
        }

        if (customerId) {
          await getStripe().customers.update(customerId, { metadata: { userId } });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      const update: Partial<typeof users.$inferInsert> = {
        subscriptionStatus: sub.status,
        currentPeriodEnd: periodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        stripeSubscriptionId: sub.id,
      };

      const action = planActionForSubscription({
        status: sub.status,
        metadataPlan: sub.metadata?.plan,
        priceId: sub.items.data[0]?.price?.id,
      });

      if (action.kind === "downgrade") {
        // Dunning exhausted (or canceled mid-cycle) — drop to free and stop
        // over-quota runtimes. `past_due` is intentionally NOT downgraded (it
        // maps to `restore`) because Stripe is still retrying the card.
        update.plan = "free";
        await db.update(users).set(update).where(eq(users.id, userId));
        const { stopped } = await reconcileServersForPlan(userId, "free");
        audit({
          userId,
          action: "plan.downgrade",
          targetType: "subscription",
          targetId: sub.id,
          metadata: { reason: sub.status, stripeEvent: event.id, serversStopped: stopped.length },
        });
        notifyDowngrade(userId, sub.status).catch(() => {});
      } else {
        // Restore the paid plan the subscription is for (active/trialing, or a
        // recovered past_due) so a customer whose payment retried successfully
        // isn't left paying while pinned to free.
        if (action.kind === "restore") update.plan = action.plan;
        await db.update(users).set(update).where(eq(users.id, userId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      await db
        .update(users)
        .set({
          plan: "free",
          subscriptionStatus: "canceled",
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
        })
        .where(eq(users.id, userId));

      const { stopped } = await reconcileServersForPlan(userId, "free");

      audit({
        userId,
        action: "plan.cancel",
        targetType: "subscription",
        targetId: sub.id,
        metadata: {
          reason: "subscription_deleted",
          stripeEvent: event.id,
          serversStopped: stopped.length,
        },
      });
      notifyDowngrade(userId, "canceled").catch(() => {});
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer?.toString() ?? null);
      if (!customerId) break;
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      // Don't downgrade yet — Stripe will keep retrying and emit
      // subscription.updated with past_due/unpaid status when it gives
      // up. Just record the failed attempt so we can surface a banner.
      //
      // In Stripe API 2026-03 dahlia, invoice.subscription was removed in
      // favour of invoice.parent.subscription_details.subscription. We
      // best-effort extract the subscription id for the audit row and
      // accept null if the shape changes again.
      let subscriptionId: string | null = null;
      const parent = (
        invoice as unknown as {
          parent?: { subscription_details?: { subscription?: string | { id?: string } } };
        }
      ).parent;
      const raw = parent?.subscription_details?.subscription;
      if (typeof raw === "string") subscriptionId = raw;
      else if (raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string") {
        subscriptionId = raw.id;
      }

      audit({
        userId,
        action: "plan.downgrade",
        targetType: "subscription",
        targetId: subscriptionId,
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

  return NextResponse.json({ received: true });
}
