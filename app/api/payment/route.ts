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
    if (!key || key.includes('your-stripe')) throw new Error('STRIPE_SECRET_KEY is not configured');
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
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const stripe = getStripe();
    const body = await req.json();
    const { amount, currency = 'eur', description: rawDescription } = body;

    // Sanitize description: cap length, strip HTML, fallback to empty
    const description = typeof rawDescription === 'string'
      ? rawDescription.replace(/<[^>]*>/g, '').slice(0, 200).trim() || undefined
      : undefined;

    const MAX_AMOUNT = 10000; // 10 000€ safety cap
    const ALLOWED_CURRENCIES = ['eur', 'usd', 'gbp'];

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }
    if (amount > MAX_AMOUNT) {
      return NextResponse.json({ error: 'Montant trop élevé' }, { status: 400 });
    }
    if (typeof currency !== 'string' || !ALLOWED_CURRENCIES.includes(currency.toLowerCase())) {
      return NextResponse.json({ error: 'Devise non supportée' }, { status: 400 });
    }
    const normalizedCurrency = currency.toLowerCase();

    // Create a Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: normalizedCurrency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: auth.userId,
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
