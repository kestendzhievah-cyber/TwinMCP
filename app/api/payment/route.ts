import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { isStripeConfigured } from '@/lib/services/stripe-billing.service';
import { validateAuth } from '@/lib/firebase-admin-auth';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
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
    const { amount, currency = 'eur', description } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }

    // Create a Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: auth.userId ?? 'unknown',
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error('Erreur lors de la création du Payment Intent:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
