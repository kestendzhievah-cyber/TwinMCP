import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { priceId, customerEmail } = body;

    if (!priceId || !customerEmail) {
      return NextResponse.json({ error: 'Price ID et email requis' }, { status: 400 });
    }

    // Create or retrieve customer
    let customer = await stripe.customers.list({ email: customerEmail }).then(res => res.data[0]);

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
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'abonnement:", error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const subscriptionId = url.searchParams.get('subscriptionId');

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Subscription ID requis' }, { status: 400 });
  }

  const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any;

  return NextResponse.json({
    status: subscription.status,
    current_period_end: subscription.current_period_end,
  });
}
