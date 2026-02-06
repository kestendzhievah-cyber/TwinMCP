import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe only if key is available
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('your-stripe')) {
    return null;
  }
  return new Stripe(key);
};

// Plans et prix - Correspondant à la page pricing
const PLANS = {
  free: {
    name: 'Free',
    monthly: { amount: 0 },
    yearly: { amount: 0 },
  },
  professional: {
    name: 'Professional',
    monthly: {
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      amount: 1499, // 14.99€ en centimes
    },
    yearly: {
      priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
      amount: 13488, // 11.24€ x 12 = 134.88€ en centimes
    },
  },
  // Legacy plans for backwards compatibility
  starter: {
    name: 'Starter',
    monthly: {
      priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
      amount: 900,
    },
    yearly: {
      priceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
      amount: 9000,
    },
  },
  enterprise: {
    name: 'Enterprise',
    monthly: { amount: null }, // Contact sales
    yearly: { amount: null },
  },
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    
    if (!stripe) {
      console.error('Stripe not configured - missing STRIPE_SECRET_KEY');
      return NextResponse.json(
        { 
          error: 'Service de paiement non configuré. Veuillez contacter le support.',
          code: 'STRIPE_NOT_CONFIGURED'
        },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { 
      planId, 
      billingPeriod = 'monthly', 
      userId, 
      userEmail,
      userName,
      mode = 'subscription'
    } = body

    // Validation
    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID requis' },
        { status: 400 }
      )
    }

    // Free plan - no payment needed
    if (planId === 'free') {
      return NextResponse.json(
        { error: 'Le plan gratuit ne nécessite pas de paiement', code: 'FREE_PLAN' },
        { status: 400 }
      )
    }

    // Enterprise - contact sales
    if (planId === 'enterprise') {
      return NextResponse.json(
        { error: 'Veuillez nous contacter pour le plan Enterprise', code: 'CONTACT_SALES' },
        { status: 400 }
      )
    }

    // Get plan config
    const plan = PLANS[planId as keyof typeof PLANS]
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan invalide' },
        { status: 400 }
      )
    }

    const priceConfig = plan[billingPeriod as 'monthly' | 'yearly']
    if (!priceConfig || priceConfig.amount === null) {
      return NextResponse.json(
        { error: 'Configuration de prix invalide' },
        { status: 400 }
      )
    }

    // Build line items
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (priceConfig.priceId && !priceConfig.priceId.includes('your-')) {
      // Use pre-configured Stripe price
      lineItems = [{
        price: priceConfig.priceId,
        quantity: 1,
      }];
    } else {
      // Create price on the fly
      lineItems = [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `TwinMCP ${plan.name}`,
            description: billingPeriod === 'yearly' 
              ? 'Abonnement annuel - 25% de réduction' 
              : 'Abonnement mensuel',
          },
          unit_amount: priceConfig.amount,
          recurring: mode === 'subscription' ? {
            interval: billingPeriod === 'yearly' ? 'year' : 'month',
          } : undefined,
        },
        quantity: 1,
      }];
    }

    // Session config
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: mode as Stripe.Checkout.SessionCreateParams.Mode,
      line_items: lineItems,
      success_url: `${req.nextUrl.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/pricing?canceled=true`,
      metadata: {
        planId,
        billingPeriod,
        userId: userId || 'anonymous',
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      locale: 'fr',
    }

    // Handle customer
    if (userEmail) {
      try {
        const existingCustomers = await stripe.customers.list({ 
          email: userEmail,
          limit: 1
        });
        
        if (existingCustomers.data.length > 0) {
          sessionConfig.customer = existingCustomers.data[0].id;
        } else {
          sessionConfig.customer_email = userEmail;
        }
      } catch (customerError) {
        console.warn('Customer lookup failed:', customerError);
        sessionConfig.customer_email = userEmail;
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    
    // Check for common Stripe errors
    if (errorMessage.includes('Invalid API Key')) {
      return NextResponse.json(
        { error: 'Configuration Stripe invalide. Contactez le support.', code: 'INVALID_API_KEY' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur lors de la création de la session de paiement', details: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Retrieve session details (for success page)
export async function GET(req: NextRequest) {
  try {
    const stripe = getStripe();
    
    if (!stripe) {
      return NextResponse.json(
        { error: 'Service de paiement non configuré' },
        { status: 503 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID requis' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les détails de la session' },
      { status: 500 }
    );
  }
}
