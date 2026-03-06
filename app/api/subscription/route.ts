import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { isStripeConfigured } from '@/lib/services/stripe-billing.service';
import { validateAuth } from '@/lib/firebase-admin-auth';

// Cached Stripe client singleton — avoids creating a new client per request
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Service de paiement non configuré' },
        { status: 503 }
      );
    }

    const auth = await validateAuth(req.headers.get('authorization'));
    if (!auth.valid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const stripe = getStripe();
    const body = await req.json();
    const { priceId, customerEmail } = body;

    if (!priceId || !customerEmail) {
      return NextResponse.json({ error: 'Price ID et email requis' }, { status: 400 });
    }

    // Create or retrieve customer
    let customer = await stripe.customers
      .list({ email: customerEmail, limit: 1 })
      .then((res) => res.data[0]);

    if (!customer) {
      customer = await stripe.customers.create({
        email: customerEmail,
      });
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent
        ?.client_secret,
    });
  } catch (error) {
    logger.error("Erreur lors de la création de l'abonnement:", error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Service de paiement non configuré' },
        { status: 503 }
      );
    }

    // Require authentication — prevent unauthenticated subscription lookups
    const auth = await validateAuth(req.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const stripe = getStripe();
    const url = new URL(req.url);
    const subscriptionId = url.searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID requis' },
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    });

    // Verify the subscription belongs to the authenticated user's Stripe customer
    const { prisma } = await import('@/lib/prisma');
    const dbUser = await prisma.user.findFirst({
      where: { OR: [{ id: auth.userId }, { oauthId: auth.userId }] },
      include: { profile: true },
    });
    const customerIdFromSub = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (dbUser?.profile?.stripeCustomerId && customerIdFromSub !== dbUser.profile.stripeCustomerId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    return NextResponse.json({
      status: subscription.status,
      current_period_end: (subscription as any).current_period_end,
    });
  } catch (error) {
    logger.error('Erreur récupération abonnement:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
