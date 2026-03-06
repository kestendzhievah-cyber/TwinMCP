import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── Lazy Stripe client ─────────────────────────────────────────
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes('your-stripe')) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !key.includes('your-stripe');
}

// ─── Plan mapping (single source of truth) ───────────────────────
export const PLAN_CONFIG = {
  free: {
    name: 'Gratuit',
    slug: 'free',
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      '3 serveurs MCP',
      '200 requêtes/jour',
      'Accès bibliothèque publique',
      'Support communauté',
      'Documentation complète',
    ],
    limits: {
      mcpServers: 3,
      requestsPerDay: 200,
      privateServers: false,
    },
  },
  pro: {
    name: 'Professional',
    slug: 'pro',
    priceMonthly: 14.99,
    priceAnnual: 11.24,
    features: [
      'Serveurs MCP illimités',
      '10 000 requêtes/jour',
      'Serveurs privés',
      'Support prioritaire 24/7',
      'Analytics avancés',
      'API complète',
      'Webhooks & intégrations',
    ],
    limits: {
      mcpServers: -1, // unlimited
      requestsPerDay: 10000,
      privateServers: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    slug: 'enterprise',
    priceMonthly: -1, // custom
    priceAnnual: -1,
    features: [
      'Tout du plan Pro',
      'Requêtes illimitées',
      'Serveurs MCP sur-mesure',
      'Account manager dédié',
      'SLA 99.9%',
      'Déploiement on-premise',
      'Formation & onboarding',
      'White-label disponible',
    ],
    limits: {
      mcpServers: -1,
      requestsPerDay: -1,
      privateServers: true,
    },
  },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

// Aliases for backward compatibility
const PLAN_ALIASES: Record<string, PlanId> = {
  professional: 'pro',
  starter: 'pro',
};

export function resolvePlanId(input: string): PlanId {
  if (input in PLAN_CONFIG) return input as PlanId;
  return PLAN_ALIASES[input] ?? 'free';
}

export function getPlanLimits(planId: string) {
  const resolved = resolvePlanId(planId);
  return PLAN_CONFIG[resolved].limits;
}

// ─── Stripe Customer management ──────────────────────────────────

/**
 * Get or create a Stripe customer for the given user profile.
 * Persists the stripeCustomerId in the DB.
 */
export async function getOrCreateStripeCustomer(
  userProfileId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const stripe = getStripe();

  // Check if we already have a Stripe customer ID
  const profile = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    select: { stripeCustomerId: true },
  });

  if (profile?.stripeCustomerId) {
    return profile.stripeCustomerId;
  }

  // Check if a customer exists in Stripe with this email
  const existing = await stripe.customers.list({ email, limit: 1 });
  let customerId: string;

  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email,
      name: name ?? undefined,
      metadata: { userProfileId },
    });
    customerId = customer.id;
  }

  // Atomic persist — only set stripeCustomerId if it's still null (prevents race condition
  // where two concurrent requests both create a Stripe customer)
  const updated = await prisma.userProfile.updateMany({
    where: { id: userProfileId, stripeCustomerId: null },
    data: { stripeCustomerId: customerId },
  });

  // If another request already set it, fetch and use that one instead
  if (updated.count === 0) {
    const existing = await prisma.userProfile.findUnique({
      where: { id: userProfileId },
      select: { stripeCustomerId: true },
    });
    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }
  }

  return customerId;
}

// ─── Checkout Session ────────────────────────────────────────────

export interface CreateCheckoutParams {
  planId: string;
  billingPeriod: 'monthly' | 'yearly';
  userProfileId: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(params: CreateCheckoutParams) {
  const stripe = getStripe();
  const resolved = resolvePlanId(params.planId);
  const plan = PLAN_CONFIG[resolved];

  if (resolved === 'free') {
    throw new Error('FREE_PLAN');
  }
  if (resolved === 'enterprise') {
    throw new Error('CONTACT_SALES');
  }

  const price =
    params.billingPeriod === 'yearly' ? plan.priceAnnual : plan.priceMonthly;
  if (price <= 0) {
    throw new Error('INVALID_PRICE');
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    params.userProfileId,
    params.userEmail,
    params.userName
  );

  // Build line items — prefer Stripe Price IDs from env if available
  const envPriceId =
    params.billingPeriod === 'yearly'
      ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
      : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

  if (envPriceId && !envPriceId.includes('your-')) {
    lineItems = [{ price: envPriceId, quantity: 1 }];
  } else {
    // Create price on the fly (works for testing without pre-created Stripe prices)
    lineItems = [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `TwinMCP ${plan.name}`,
            description:
              params.billingPeriod === 'yearly'
                ? 'Abonnement annuel - 25% de réduction'
                : 'Abonnement mensuel',
          },
          unit_amount: Math.round(price * 100),
          recurring: {
            interval: params.billingPeriod === 'yearly' ? 'year' : 'month',
          },
        },
        quantity: 1,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      planId: resolved,
      billingPeriod: params.billingPeriod,
      userId: params.userId,
      userProfileId: params.userProfileId,
    },
    subscription_data: {
      metadata: {
        planId: resolved,
        userId: params.userId,
        userProfileId: params.userProfileId,
      },
      ...(resolved === 'pro' && parseInt(process.env.TRIAL_DAYS ?? '14', 10) > 0
        ? { trial_period_days: parseInt(process.env.TRIAL_DAYS ?? '14', 10) }
        : {}),
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    locale: 'fr',
  });

  return { url: session.url, sessionId: session.id };
}

// ─── Customer Portal ─────────────────────────────────────────────

export async function createCustomerPortalSession(
  userProfileId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const profile = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    select: { stripeCustomerId: true },
  });

  if (!profile?.stripeCustomerId) {
    throw new Error('No Stripe customer found for this user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ─── Webhook processing ──────────────────────────────────────────

export async function constructWebhookEvent(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return stripe.webhooks.constructEvent(body, signature, secret);
}

/**
 * Process a verified Stripe webhook event.
 * This is the single place where Stripe events update the DB.
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      logger.info(`[stripe-webhook] Unhandled event: ${event.type}`);
  }
}

// ─── Webhook handlers (private) ──────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userProfileId = session.metadata?.userProfileId;
  const planId = session.metadata?.planId;
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  if (!userProfileId || !planId || !customerId) {
    logger.warn('[stripe-webhook] checkout.session.completed missing metadata', {
      userProfileId,
      planId,
      customerId,
    });
    return;
  }

  // Persist Stripe customer ID and update plan
  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: {
      stripeCustomerId: customerId,
      plan: resolvePlanId(planId),
    },
  });

  logger.info(`[stripe-webhook] Checkout completed for profile=${userProfileId}, plan=${planId}`);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const planId = sub.metadata?.planId ?? 'pro';
  const userProfileId = sub.metadata?.userProfileId;
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

  // Find user profile by Stripe customer ID or metadata
  let profileId: string | undefined = userProfileId ?? undefined;
  if (!profileId && customerId) {
    const profile = await prisma.userProfile.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    profileId = profile?.id ?? undefined;
  }

  if (!profileId) {
    logger.warn('[stripe-webhook] subscription.updated — no profile found', {
      stripeSubscriptionId: sub.id,
      customerId,
    });
    return;
  }

  const resolved = resolvePlanId(planId);
  const interval = sub.items.data[0]?.plan?.interval;
  const amount = (sub.items.data[0]?.plan?.amount ?? 0) / 100;

  // Atomic: upsert subscription + update user plan in a single transaction
  const newPlan = sub.status === 'active' || sub.status === 'trialing' ? resolved : 'free';
  const subData = {
    status: mapStripeSubStatus(sub.status),
    plan: resolved,
    stripeCustomerId: customerId ?? undefined,
    stripePriceId: sub.items.data[0]?.price?.id ?? undefined,
    currentPeriodStart: new Date((sub as any).current_period_start * 1000),
    currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    amount,
    currency: sub.currency.toUpperCase(),
    interval: (interval === 'year' ? 'YEAR' : 'MONTH') as 'YEAR' | 'MONTH',
    trialStart: (sub as any).trial_start
      ? new Date((sub as any).trial_start * 1000)
      : null,
    trialEnd: (sub as any).trial_end
      ? new Date((sub as any).trial_end * 1000)
      : null,
  };

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      update: subData,
      create: {
        userId: profileId,
        stripeSubscriptionId: sub.id,
        ...subData,
      },
    }),
    prisma.userProfile.update({
      where: { id: profileId },
      data: { plan: newPlan },
    }),
  ]);

  logger.info(
    `[stripe-webhook] Subscription ${sub.id} updated → plan=${newPlan}, status=${sub.status}`
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

  // Atomic: mark subscription cancelled + downgrade user to free in one transaction
  const ops: any[] = [];

  // Check if subscription exists in DB first
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });

  if (existingSub) {
    ops.push(
      prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: { status: 'CANCELLED', cancelAtPeriodEnd: false },
      })
    );
  } else {
    logger.warn(`[stripe-webhook] subscription.deleted — sub ${sub.id} not found in DB`);
  }

  if (customerId) {
    ops.push(
      prisma.userProfile.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: 'free' },
      })
    );
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  logger.info(`[stripe-webhook] Subscription ${sub.id} deleted → downgraded to free`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  logger.info(
    `[stripe-webhook] Invoice ${invoice.id} paid — amount: ${invoice.amount_paid}, customer: ${customerId}`
  );

  // If this invoice is tied to a subscription, ensure the subscription status is current
  const rawSub = (invoice as any).subscription;
  const stripeSubId = typeof rawSub === 'string' ? rawSub : rawSub?.id;

  if (stripeSubId) {
    try {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSubId },
        data: { status: 'ACTIVE' },
      });
    } catch (e) {
      logger.warn(`[stripe-webhook] Could not update subscription ${stripeSubId} on invoice paid:`, e);
    }
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  logger.warn(
    `[stripe-webhook] Invoice ${invoice.id} payment failed — attempt: ${invoice.attempt_count}, customer: ${customerId}`
  );

  // If payment failed on a subscription invoice, mark the subscription as PAUSED
  // so the user sees a warning in the dashboard
  const rawSub = (invoice as any).subscription;
  const stripeSubId = typeof rawSub === 'string' ? rawSub : rawSub?.id;

  if (stripeSubId) {
    try {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSubId },
        data: { status: 'PAUSED' },
      });
    } catch (e) {
      logger.warn(`[stripe-webhook] Could not pause subscription ${stripeSubId} on invoice failure:`, e);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function mapStripeSubStatus(
  status: Stripe.Subscription.Status
): 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAUSED';
    case 'canceled':
      return 'CANCELLED';
    case 'incomplete':
    case 'incomplete_expired':
      return 'EXPIRED';
    default:
      return 'ACTIVE';
  }
}
