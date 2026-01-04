import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Define your price IDs for each plan
const PRICE_IDS = {
  starter: {
    monthly: 'price_starter_monthly_id', // Replace with actual Stripe price ID
    yearly: 'price_starter_yearly_id',
  },
  professional: {
    monthly: 'price_professional_monthly_id',
    yearly: 'price_professional_yearly_id',
  },
  enterprise: {
    monthly: 'price_enterprise_monthly_id',
    yearly: 'price_enterprise_yearly_id',
  },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { priceId, userId, userEmail, billingPeriod = 'monthly' } = body

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'User ID et email requis' },
        { status: 400 }
      )
    }

    // Find the price ID based on plan and period
    let selectedPriceId = priceId

    if (!selectedPriceId) {
      // If no specific priceId, determine from plan ID
      for (const [plan, prices] of Object.entries(PRICE_IDS)) {
        if (prices[billingPeriod as keyof typeof prices] === priceId) {
          selectedPriceId = priceId
          break
        }
      }
    }

    if (!selectedPriceId) {
      return NextResponse.json(
        { error: 'Price ID invalide' },
        { status: 400 }
      )
    }

    // Create or retrieve customer
    let customer = await stripe.customers.list({ email: userEmail }).then(res => res.data[0])

    if (!customer) {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.nextUrl.origin}/dashboard?success=true`,
      cancel_url: `${req.nextUrl.origin}/pricing?canceled=true`,
      metadata: { userId },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Erreur lors de la création de la session:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
