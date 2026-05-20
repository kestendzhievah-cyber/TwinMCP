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
      if (userId && plan) {
        const [previous] = await db
          .select({ plan: users.plan, email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        await db.update(users).set({ plan }).where(eq(users.id, userId));

        audit({
          userId,
          action: "plan.upgrade",
          targetType: "subscription",
          targetId: typeof session.subscription === "string" ? session.subscription : null,
          metadata: { from: previous?.plan ?? null, to: plan, stripeEvent: event.id },
        });

        if (previous?.email) {
          sendUpgradeConfirmationEmail(previous.email, plan).catch(() => {});
        }

        if (session.customer && typeof session.customer === "string") {
          await getStripe().customers.update(session.customer, {
            metadata: { userId },
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
      const customer = (await getStripe().customers.retrieve(customerId)) as Stripe.Customer;
      const userId = customer.metadata?.userId;
      if (userId) {
        await db.update(users).set({ plan: "free" }).where(eq(users.id, userId));
        audit({
          userId,
          action: "plan.cancel",
          targetType: "subscription",
          targetId: sub.id,
          metadata: { reason: "subscription_deleted", stripeEvent: event.id },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.status === "past_due" || sub.status === "unpaid") {
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
        const customer = (await getStripe().customers.retrieve(customerId)) as Stripe.Customer;
        const userId = customer.metadata?.userId;
        if (userId) {
          await db.update(users).set({ plan: "free" }).where(eq(users.id, userId));
          audit({
            userId,
            action: "plan.downgrade",
            targetType: "subscription",
            targetId: sub.id,
            metadata: { reason: sub.status, stripeEvent: event.id },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
