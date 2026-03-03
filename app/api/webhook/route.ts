import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import {
  constructWebhookEvent,
  processWebhookEvent,
  isStripeConfigured,
} from '@/lib/services/stripe-billing.service';

/**
 * Main Stripe webhook endpoint.
 * Verifies signature, then delegates to the centralized billing service
 * which performs real DB updates (subscriptions, plans, invoices).
 */
export async function POST(req: NextRequest) {
  const start = Date.now();

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify signature + construct event
    let event;
    try {
      event = await constructWebhookEvent(body, signature);
    } catch (err) {
      logger.error('[webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Process event (updates DB)
    try {
      await processWebhookEvent(event);
    } catch (err) {
      logger.error(`[webhook] Error processing ${event.type}:`, err);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      type: event.type,
      processedIn: `${Date.now() - start}ms`,
    });
  } catch (error) {
    logger.error('[webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
