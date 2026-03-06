'use client'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Lazy-load Stripe only when the key is available — avoids crash if env var is missing
let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('[StripeProvider] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured');
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(key);
    }
  }
  return stripePromise;
}

export function StripeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Elements stripe={getStripePromise()}>
      {children}
    </Elements>
  )
}
