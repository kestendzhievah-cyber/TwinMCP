import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import {
  constructWebhookEvent,
  processWebhookEvent,
  isStripeConfigured,
} from '@/lib/services/stripe-billing.service';
import { markProcessed } from '@/lib/services/webhook-idempotency';

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

    // Idempotency: skip if already processed by this or the other webhook route
    if (!markProcessed(event.id)) {
      logger.info(`[webhook] Duplicate event ${event.id} — skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Process event (updates DB)
    try {
      await processWebhookEvent(event);
    } catch (err) {
      // Log the error but return 200 to acknowledge receipt.
      // Returning 4xx/5xx causes Stripe to retry for up to 3 days.
      logger.error(`[webhook] Error processing ${event.type}:`, err);
      return NextResponse.json(
        { received: true, error: 'Processing failed' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      received: true,
      type: event.type,
      processedIn: `${Date.now() - start}ms`,
    });
  } catch (error) {
    // Return 200 to acknowledge receipt — returning 5xx causes Stripe to retry for 3 days.
    // The event will be logged for manual investigation.
    logger.error('[webhook] Unexpected error:', error);
    return NextResponse.json(
      { received: true, error: 'Unexpected error' },
      { status: 200 }
    );
  }
}
