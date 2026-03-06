'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Stripe } from '@stripe/stripe-js';

// Context to provide lazy Stripe instance to children
const StripeContext = createContext<{
  getStripe: () => Promise<Stripe | null>;
}>({
  getStripe: () => Promise.resolve(null),
});

export function useStripeLoader() {
  return useContext(StripeContext);
}

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lightweight Stripe provider that does NOT load Stripe.js on every page.
 * Stripe SDK (~40KB) is only fetched when getStripe() is actually called
 * (i.e., on payment/billing pages).
 */
export function StripeProvider({ children }: { children: React.ReactNode }) {
  const getStripe = useCallback(async () => {
    if (!stripePromise) {
      const { loadStripe } = await import('@stripe/stripe-js');
      stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
    }
    return stripePromise;
  }, []);

  return <StripeContext.Provider value={{ getStripe }}>{children}</StripeContext.Provider>;
}

// Lazy-load @stripe/react-stripe-js at module scope (not inside render)
const LazyStripeElements = React.lazy(() =>
  import('@stripe/react-stripe-js').then(mod => ({
    default: mod.Elements,
  }))
);

/**
 * Wrap payment components with this to get the full Stripe Elements context.
 * Only import and use this in billing/payment pages.
 */
export function StripeElements({ children }: { children: React.ReactNode }) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const { getStripe } = useStripeLoader();

  React.useEffect(() => {
    getStripe().then(s => {
      setStripe(s);
      setLoading(false);
    });
  }, [getStripe]);

  if (loading || !stripe) {
    return <>{children}</>;
  }

  return (
    <React.Suspense fallback={children}>
      <LazyStripeElements stripe={stripe}>{children}</LazyStripeElements>
    </React.Suspense>
  );
}
