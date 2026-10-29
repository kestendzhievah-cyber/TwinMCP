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
  invoicePriceId,
  isTrialConversion,
  cancellationScheduled,
  cancellationReason,
  TRIAL_DAYS,
  type Cadence,
} from "@/lib/stripe";
import {
  sendUpgradeConfirmationEmail,
  sendPlanDowngradeEmail,
  sendTrialEndingEmail,
  sendCheckoutRecoveryEmail,
} from "@/lib/email";
import { reconcileServersForPlan } from "@/lib/billing/reconcile";
import { emailNudgesEnabled, isDeliverableEmail } from "@/lib/billing/quota-nudge";
import { parseNudgeDate } from "@/lib/billing/nudge-state";
import { attributionMetadata } from "@/lib/billing/checkout";
import { getDailyLimit } from "@/lib/rate-limit";
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

const DAY_MS = 86_400_000;

/**
 * Best-effort "your free month ends in N days" email. Stripe fires
 * customer.subscription.trial_will_end 3 days before the first invoice.
 * Honours users.metadata.emailNudges; never throws (an email outage must not
 * release the idempotency claim and make Stripe retry the whole event).
 */
async function notifyTrialEnding(userId: string, sub: Stripe.Subscription): Promise<void> {
  try {
    const endsAt =
      typeof sub.trial_end === "number" ? new Date(sub.trial_end * 1000) : periodEnd(sub);
    if (!endsAt) return;
    // Stripe still fires trial_will_end for a trial the user already cancelled
    // from the portal (cancel at period end): nothing continues and nothing is
    // charged, so the "your subscription continues" email would be false.
    if (sub.cancel_at_period_end || sub.status !== "trialing") return;

    const [u] = await getDb()
      .select({ email: users.email, metadata: users.metadata })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u || !isDeliverableEmail(u.email) || !emailNudgesEnabled(u.metadata)) return;

    const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / DAY_MS));
    await sendTrialEndingEmail(u.email, { endsAt, daysLeft });
    trackServer({
      event: "upgrade_email_sent",
      distinctId: userId,
      properties: { kind: "trial_ending", reason: "trial_ending", daysLeft },
    });
  } catch (err) {
    console.warn("[stripe webhook] trial-ending email skipped:", err);
    Sentry.captureException(err, { tags: { area: "upgrade-nudge", stage: "trial-email" } });
  }
}

// ---- users.metadata.billing ------------------------------------------------
// Lifecycle stamps the webhook keeps on the account (no migration: jsonb).
//   trialStartedAt      checkout.session.completed with a trialing subscription
//   trialConvertedAt    first paid invoice after that trial (counted once)
//   checkoutRecoveryAt  last abandoned-checkout reminder (cooldown)

interface BillingMeta {
  trialStartedAt?: string | null;
  trialConvertedAt?: string | null;
  checkoutRecoveryAt?: string | null;
}

function billingMeta(metadata: unknown): BillingMeta {
  const b =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).billing
      : undefined;
  return b && typeof b === "object" && !Array.isArray(b) ? (b as BillingMeta) : {};
}

/**
 * Atomic jsonb merge, in one UPDATE, so a concurrent writer (nudge job,
 * preferences, onboarding) is never clobbered by a read-modify-write:
 *   metadata = metadata || top || {"billing": metadata.billing || billing}
 */
function metadataMergeSql(top: Record<string, unknown> | null, billing: BillingMeta | null) {
  let expr = sql`COALESCE(${users.metadata}, '{}'::jsonb)`;
  if (top) expr = sql`${expr} || ${JSON.stringify(top)}::jsonb`;
  if (billing) {
    expr = sql`${expr} || jsonb_build_object('billing', (CASE WHEN jsonb_typeof(${users.metadata}->'billing') = 'object' THEN ${users.metadata}->'billing' ELSE '{}'::jsonb END) || ${JSON.stringify(billing)}::jsonb)`;
  }
  return expr;
}

async function stampBilling(userId: string, billing: BillingMeta): Promise<void> {
  await getDb()
    .update(users)
    .set({ metadata: metadataMergeSql(null, billing) })
    .where(eq(users.id, userId));
}

/**
 * First-touch attribution as analytics properties: the shared keys only
 * (lib/billing/checkout.ts), and the raw Google click id replaced by a
 * presence flag — PostHog needs to know an ad brought the user, not the id.
 */
function attributionProps(source: unknown): Record<string, string | boolean> {
  const meta = attributionMetadata(
    source && typeof source === "object" ? (source as Record<string, unknown>) : null
  );
  const { gclid, ...rest } = meta;
  return { ...rest, ...(gclid ? { gclid_present: true } : {}) };
}

function storedAttribution(metadata: unknown): unknown {
  return metadata && typeof metadata === "object"
    ? (metadata as Record<string, unknown>).attribution
    : undefined;
}

function isCadence(value: unknown): value is Cadence {
  return value === "monthly" || value === "yearly";
}

/** The cadence a subscription bills at: our price ids first, then the price interval. */
function subscriptionCadence(sub: Stripe.Subscription): Cadence | null {
  const price = sub.items.data[0]?.price;
  return cadenceFromPriceId(price?.id) ?? cadenceFromInterval(price?.recurring?.interval);
}

const RECOVERY_COOLDOWN_DAYS = 7;
const SUBSCRIBED = ["active", "trialing", "past_due"];

/**
 * Abandoned Pro checkout → one reminder carrying Stripe's recovery link.
 * Returns whether an email went out. Never throws (an email outage must not
 * make Stripe retry the event). Skipped when: no recovery link, the account
 * is already subscribed (it may have finished in another tab), the user opted
 * out of lifecycle emails (users.metadata.emailNudges === false), no
 * deliverable address, or a reminder went out in the last RECOVERY_COOLDOWN_DAYS.
 */
async function notifyCheckoutRecovery(
  userId: string,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  try {
    const recovery = session.after_expiration?.recovery;
    const url = recovery?.url;
    if (!url) return false;

    const [u] = await getDb()
      .select({
        email: users.email,
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        metadata: users.metadata,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u) return false;
    if (u.plan !== "free" || SUBSCRIBED.includes(u.subscriptionStatus ?? "")) return false;
    if (!emailNudgesEnabled(u.metadata)) return false;

    const now = new Date();
    const last = parseNudgeDate(billingMeta(u.metadata).checkoutRecoveryAt);
    if (last && now.getTime() - last.getTime() < RECOVERY_COOLDOWN_DAYS * DAY_MS) return false;

    const candidates = [u.email, session.customer_details?.email, session.customer_email];
    const to = candidates.find((e): e is string => isDeliverableEmail(e));
    if (!to) return false;

    // The recovered session copies the original one, trial included: it had
    // the free month iff this was a first subscription without a promo.
    const trialDays =
      TRIAL_DAYS > 0 && !u.stripeCustomerId && !session.metadata?.promotionCodeId ? TRIAL_DAYS : 0;
    const expiresAt =
      typeof recovery?.expires_at === "number" ? new Date(recovery.expires_at * 1000) : null;

    await sendCheckoutRecoveryEmail(to, {
      url,
      expiresAt,
      trialDays,
      proDailyLimit: getDailyLimit("pro"),
    });
    await stampBilling(userId, { checkoutRecoveryAt: now.toISOString() });
    trackServer({
      event: "upgrade_email_sent",
      distinctId: userId,
      properties: { kind: "checkout_recovery", reason: "checkout_expired" },
    });
    return true;
  } catch (err) {
    console.warn("[stripe webhook] checkout recovery email skipped:", err);
    Sentry.captureException(err, { tags: { area: "upgrade-nudge", stage: "checkout-recovery" } });
    return false;
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
    // A handler threw AFTER shouldProcess() claimed the event. If we returned
    // 500 without releasing the claim, Stripe's retry would be deduped into a
    // no-op and the plan/status change would be lost for good. Release the
    // claim (handlers only set/upsert, so re-running is idempotent) and 500 so
    // Stripe retries and re-applies the side effects.
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

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
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

        // Promo attribution is merged into the metadata blob in SQL (see
        // metadataMergeSql) so comp flags, nudge state, attribution and any
        // other field written concurrently are never clobbered.
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

        // Period + status aren't on the checkout session — pull them from the
        // subscription so the billing UI is correct immediately after purchase.
        // Read the real status too (a trial is `trialing`, not `active`).
        let currentPeriodEnd: Date | null = null;
        let cancelAtPeriodEnd = false;
        let subStatus = "active";
        const metaCadence = session.metadata?.cadence;
        let cadence: Cadence | null = isCadence(metaCadence) ? metaCadence : null;
        let subKnown = false;
        if (subscriptionId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subscriptionId);
            currentPeriodEnd = periodEnd(sub);
            cancelAtPeriodEnd = sub.cancel_at_period_end;
            subStatus = sub.status;
            cadence = subscriptionCadence(sub) ?? cadence;
            subKnown = true;
          } catch (err) {
            console.error("[stripe webhook] retrieve subscription failed:", err);
          }
        }
        const trialing = subStatus === "trialing";
        // A subscription without a trial clears an older, never-converted
        // trial stamp, so its renewals are not mistaken for a conversion. Only
        // written when the real status was read (not the "active" fallback).
        const billingPatch: BillingMeta | null = subKnown
          ? { trialStartedAt: trialing ? new Date().toISOString() : null }
          : null;

        await db
          .update(users)
          .set({
            plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: subStatus,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            ...(promoPatch || billingPatch
              ? { metadata: metadataMergeSql(promoPatch, billingPatch) }
              : {}),
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

        // The funnel's "paid" step — without this, visitor→paid conversion is
        // not measurable (client events stop at checkout_started).
        trackServer({
          event: "plan_upgraded",
          distinctId: userId,
          properties: { plan, previousPlan: previous?.plan ?? null, status: subStatus },
        });

        // Trial → paid is measured in two steps: trial_started here, and
        // trial_converted on the first paid invoice (invoice.paid below).
        // Attribution from the session metadata (lib/billing/checkout.ts),
        // else the copy stored on the account at sign-up.
        if (trialing) {
          trackServer({
            event: "trial_started",
            distinctId: userId,
            properties: {
              plan,
              cadence,
              from: session.metadata?.from ?? null,
              ...attributionProps(storedAttribution(previous?.metadata)),
              ...attributionProps(session.metadata),
            },
          });
        }

        if (creatorSlug) {
          trackServer({
            event: "promo_redeemed",
            distinctId: userId,
            properties: { creatorSlug, promotionCodeId, plan },
          });
        }

        if (previous?.email) {
          sendUpgradeConfirmationEmail(previous.email, plan, {
            trialing,
            periodEnd: currentPeriodEnd,
          }).catch(() => {});
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

      // A cancellation scheduled from the Customer Portal (the subscription
      // keeps running until the period end, then customer.subscription.deleted
      // follows). Measured here so churn shows up when it is decided, not a
      // month later; `stage` tells the two subscription_canceled events apart.
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
            trialing: sub.status === "trialing",
            cadence: subscriptionCadence(sub),
          },
        });
      }
      break;
    }

    case "customer.subscription.trial_will_end": {
      // 3 days before the free month ends and the first invoice is issued.
      // Pure notification: the plan/status mirror is untouched here (the
      // subscription.updated that follows the first invoice handles it).
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.toString();
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;
      await notifyTrialEnding(userId, sub);
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
      trackServer({
        event: "subscription_canceled",
        distinctId: userId,
        properties: {
          reason: cancellationReason(sub.cancellation_details, "subscription_deleted"),
          stage: "ended",
          // Ended before (or at) the end of its free month = the trial never converted.
          endedInTrial:
            typeof sub.trial_end === "number" &&
            typeof sub.ended_at === "number" &&
            sub.ended_at <= sub.trial_end,
          cadence: subscriptionCadence(sub),
        },
      });
      break;
    }

    case "invoice.paid": {
      // The money event. Only the first paid invoice after a free month is
      // acted on here (trial → paid conversion); renewals and €0 invoices are
      // ignored. Plan/status mirroring stays with customer.subscription.updated.
      const invoice = event.data.object as Stripe.Invoice;
      if (!(invoice.amount_paid > 0)) break;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer?.toString() ?? null);
      if (!customerId) break;
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) break;

      const [u] = await db
        .select({ subscriptionStatus: users.subscriptionStatus, metadata: users.metadata })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!u) break;
      const billing = billingMeta(u.metadata);
      const subscriptionId = invoiceSubscriptionId(invoice);

      // Trials that started before trialStartedAt was recorded: the renewal
      // invoice right at the end of the subscription's trial is the conversion.
      let trialStarted = !!billing.trialStartedAt;
      let subCadence: Cadence | null = null;
      if (
        !trialStarted &&
        !billing.trialConvertedAt &&
        u.subscriptionStatus !== "trialing" &&
        invoice.billing_reason === "subscription_cycle" &&
        subscriptionId
      ) {
        try {
          const sub = await getStripe().subscriptions.retrieve(subscriptionId);
          subCadence = subscriptionCadence(sub);
          trialStarted =
            typeof sub.trial_end === "number" &&
            Math.abs(invoice.created - sub.trial_end) <= 2 * 86_400;
        } catch (err) {
          console.warn("[stripe webhook] retrieve subscription for invoice failed:", err);
        }
      }

      if (
        !isTrialConversion({
          amountPaid: invoice.amount_paid,
          billingReason: invoice.billing_reason,
          storedStatus: u.subscriptionStatus,
          trialStarted,
          alreadyConverted: !!billing.trialConvertedAt,
        })
      ) {
        break;
      }

      // Stamp first: a retried event (or invoice.paid racing a duplicate
      // delivery) then sees alreadyConverted and counts nothing twice.
      await stampBilling(userId, { trialConvertedAt: new Date().toISOString() });

      const cadence = cadenceFromPriceId(invoicePriceId(invoice)) ?? subCadence;
      const amount = invoice.amount_paid / 100;
      const currency = invoice.currency;
      audit({
        userId,
        action: "trial.converted",
        targetType: "subscription",
        targetId: subscriptionId,
        metadata: {
          cadence,
          amountPaid: invoice.amount_paid,
          currency,
          invoiceId: invoice.id ?? null,
          billingReason: invoice.billing_reason,
          stripeEvent: event.id,
        },
      });
      trackServer({
        event: "trial_converted",
        distinctId: userId,
        properties: {
          cadence,
          amount,
          currency,
          // PostHog revenue convention, so the paid step can be summed.
          $revenue: amount,
          ...attributionProps(storedAttribution(u.metadata)),
        },
      });
      break;
    }

    case "checkout.session.expired": {
      // Checkout sessions expire 24 h after creation. Ours are created with
      // after_expiration.recovery (lib/billing/checkout.ts), so an abandoned
      // Pro checkout comes with a link that reopens it: one reminder email.
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const userId = session.metadata?.userId ?? null;
      const emailed = userId ? await notifyCheckoutRecovery(userId, session) : false;
      trackServer({
        event: "checkout_expired",
        distinctId: userId ?? "server",
        properties: {
          from: session.metadata?.from ?? null,
          cadence: session.metadata?.cadence ?? null,
          recoverable: !!session.after_expiration?.recovery?.url,
          recoveryEmailSent: emailed,
          ...attributionProps(session.metadata),
        },
      });
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
      const subscriptionId = invoiceSubscriptionId(invoice);

      // Not a downgrade — dunning is still in progress. Logged as its own action
      // so the audit trail isn't misread as a plan change.
      audit({
        userId,
        action: "payment.failed",
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
}
