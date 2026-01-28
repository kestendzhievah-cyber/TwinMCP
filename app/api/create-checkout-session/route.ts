import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Plans et prix configurables
const PLANS = {
  starter: {
    name: 'Starter',
    monthly: {
      priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || 'price_starter_monthly',
      amount: 900, // 9€ en centimes
    },
    yearly: {
      priceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'price_starter_yearly',
      amount: 9000, // 90€ en centimes (2 mois gratuits)
    },
  },
  professional: {
    name: 'Professional',
    monthly: {
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      amount: 2900, // 29€
    },
    yearly: {
      priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
      amount: 29000, // 290€
    },
  },
  enterprise: {
    name: 'Enterprise',
    monthly: {
      priceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly',
      amount: 9900, // 99€
    },
    yearly: {
      priceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly',
      amount: 99000, // 990€
    },
  },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      planId, 
      billingPeriod = 'monthly', 
      userId, 
      userEmail,
      userName,
      mode = 'subscription' // 'subscription' ou 'payment' pour paiement unique
    } = body

    // Validation des données requises
    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID requis' },
        { status: 400 }
      )
    }

    // Récupérer le plan sélectionné
    const plan = PLANS[planId as keyof typeof PLANS]
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan invalide' },
        { status: 400 }
      )
    }

    const priceConfig = plan[billingPeriod as 'monthly' | 'yearly']
    if (!priceConfig) {
      return NextResponse.json(
        { error: 'Période de facturation invalide' },
        { status: 400 }
      )
    }

    // Configuration de base de la session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: mode as Stripe.Checkout.SessionCreateParams.Mode,
      success_url: `${req.nextUrl.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/payment/cancel?plan=${planId}`,
      metadata: {
        planId,
        billingPeriod,
        userId: userId || 'anonymous',
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      locale: 'fr',
    }

    // Créer ou récupérer le client Stripe si email fourni
    if (userEmail) {
      const existingCustomers = await stripe.customers.list({ 
        email: userEmail,
        limit: 1 
      })

      let customer: Stripe.Customer
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0]
      } else {
        customer = await stripe.customers.create({
          email: userEmail,
          name: userName,
          metadata: { userId: userId || 'anonymous' },
        })
      }
      sessionConfig.customer = customer.id
    } else {
      sessionConfig.customer_email = undefined
    }

    // Configuration des line_items selon le mode
    if (mode === 'subscription') {
      sessionConfig.line_items = [
        {
          price: priceConfig.priceId,
          quantity: 1,
        },
      ]
    } else {
      // Mode paiement unique
      sessionConfig.line_items = [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `TwinMCP ${plan.name}`,
              description: `Plan ${plan.name} - ${billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'}`,
            },
            unit_amount: priceConfig.amount,
          },
          quantity: 1,
        },
      ]
    }

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create(sessionConfig)

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })

  } catch (error: any) {
    console.error('Erreur Stripe Checkout:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la création de la session de paiement',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

// GET pour vérifier le statut d'une session
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('session_id')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID requis' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription', 'payment_intent'],
    })

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
    })

  } catch (error: any) {
    console.error('Erreur récupération session:', error)
    return NextResponse.json(
      { error: 'Session non trouvée' },
      { status: 404 }
    )
  }
}
