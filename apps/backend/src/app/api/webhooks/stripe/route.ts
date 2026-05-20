import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "@/db";
import { users, processedStripeEvents } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { sendUpgradeConfirmationEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import type { Plan } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

async function findUserIdByCustomer(customerId: string): Promise<string | undefined> {
  const customer = (await getStripe().customers.retrieve(customerId)) as Stripe.Customer;
  return customer.metadata?.userId;
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
    // an audit log than refuse to handle the event.
    console.error("[stripe webhook] idempotency check failed:", err);
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
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;

      if (userId && plan) {
        const [previous] = await db
          .select({ plan: users.plan, email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        await db
          .update(users)
          .set({
            plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active",
          })
          .where(eq(users.id, userId));

        audit({
          userId,
          action: "plan.upgrade",
          targetType: "subscription",
          targetId: subscriptionId,
          metadata: { from: previous?.plan ?? null, to: plan, stripeEvent: event.id },
        });

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
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      const update: Partial<typeof users.$inferInsert> = {
        subscriptionStatus: sub.status,
        currentPeriodEnd: periodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        stripeSubscriptionId: sub.id,
      };

      if (sub.status === "past_due" || sub.status === "unpaid") {
        update.plan = "free";
        await db.update(users).set(update).where(eq(users.id, userId));
        audit({
          userId,
          action: "plan.downgrade",
          targetType: "subscription",
          targetId: sub.id,
          metadata: { reason: sub.status, stripeEvent: event.id },
        });
      } else {
        await db.update(users).set(update).where(eq(users.id, userId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
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

      audit({
        userId,
        action: "plan.cancel",
        targetType: "subscription",
        targetId: sub.id,
        metadata: { reason: "subscription_deleted", stripeEvent: event.id },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.toString() ?? null;
      if (!customerId) break;
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      // Don't downgrade yet — Stripe will keep retrying and emit
      // subscription.updated with past_due/unpaid status when it gives
      // up. Just record the failed attempt so we can surface a banner.
      audit({
        userId,
        action: "plan.downgrade",
        targetType: "subscription",
        targetId:
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.toString() ?? null,
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
