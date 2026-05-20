import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "@/db";
import { users } from "@/db/schema";
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

async function findUserIdByCustomer(
  customerId: string
): Promise<string | undefined> {
  const customer = (await getStripe().customers.retrieve(customerId)) as Stripe.Customer;
  return customer.metadata?.userId;
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

        // Make sure the customer carries metadata.userId for future
        // reverse-lookups (e.g. legacy portal queries).
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

      // Downgrade to free if Stripe says the subscription has stopped
      // paying. Don't touch plan on healthy renewals.
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
  }

  return NextResponse.json({ received: true });
}
