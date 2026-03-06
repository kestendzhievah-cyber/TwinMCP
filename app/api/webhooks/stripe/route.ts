import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getStripeWebhookServices } from '../_shared';
import { PaymentStatus, InvoiceStatus } from '@/src/types/invoice.types';
import { processWebhookEvent } from '@/lib/services/stripe-billing.service';
import { markProcessed } from '@/lib/services/webhook-idempotency';

type Services = Awaited<ReturnType<typeof getStripeWebhookServices>>;

export async function POST(request: NextRequest) {
  const svc = await getStripeWebhookServices();
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const event = await svc.stripeService.constructWebhookEvent(body, signature);

    // Idempotency: skip if this event was already processed by this or the other webhook route
    if (!markProcessed(event.id)) {
      logger.info(`[webhooks/stripe] Duplicate event ${event.id} — skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    await svc.auditService.logSecurityEvent(
      'stripe_webhook_received',
      'low',
      `Webhook event type: ${event.type}, eventId: ${event.id}`
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        try {
          await handlePaymentIntentSucceeded(svc, event.data.object);
        } catch (procErr) {
          logger.error(`[webhooks/stripe] Error processing payment_intent.succeeded:`, procErr);
        }
        break;

      case 'payment_intent.payment_failed':
        try {
          await handlePaymentIntentFailed(svc, event.data.object);
        } catch (procErr) {
          logger.error(`[webhooks/stripe] Error processing payment_intent.payment_failed:`, procErr);
        }
        break;

      case 'charge.refunded':
        try {
          await handleChargeRefunded(svc, event.data.object);
        } catch (procErr) {
          logger.error(`[webhooks/stripe] Error processing charge.refunded:`, procErr);
        }
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        // Delegate ALL billing events to centralized service for DB updates
        try {
          await processWebhookEvent(event);
        } catch (procErr) {
          logger.error(`[webhooks/stripe] Error processing ${event.type}:`, procErr);
          // Don't re-throw — acknowledge receipt to prevent Stripe retry storm
        }
        try {
          await handleSubscriptionEvent(svc, event.type, event.data.object);
        } catch (auditErr) {
          logger.error(`[webhooks/stripe] Error in subscription audit log:`, auditErr);
        }
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    await svc.auditService.logSecurityEvent(
      'stripe_webhook_error',
      'medium',
      'Webhook processing failed'
    ).catch(() => {});

    // Signature verification failures → 400. Processing errors → 200.
    const isSignatureError = error instanceof Error &&
      (error.message.includes('signature') || error.message.includes('Webhook'));
    if (isSignatureError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    return NextResponse.json({ received: true, error: 'Processing failed' }, { status: 200 });
  }
}

async function handlePaymentIntentSucceeded(svc: Services, paymentIntent: any) {
  try {
    const paymentId = paymentIntent.metadata?.paymentId;
    const invoiceId = paymentIntent.metadata?.invoiceId;

    if (paymentId) {
      await svc.paymentService.updatePaymentStatus(
        paymentId,
        PaymentStatus.COMPLETED,
        paymentIntent.id
      );
    }

    if (invoiceId) {
      await svc.invoiceService.updateInvoiceStatus(invoiceId, InvoiceStatus.PAID, {
        paidVia: 'stripe',
        stripePaymentIntentId: paymentIntent.id,
        paidAt: new Date(),
      });
    }

    await svc.auditService.logSecurityEvent(
      'payment_succeeded',
      'low',
      `Payment succeeded for invoice ${invoiceId}, paymentId: ${paymentId}, amount: ${paymentIntent.amount}`
    );
  } catch (error) {
    logger.error('Error handling payment intent succeeded:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(svc: Services, paymentIntent: any) {
  try {
    const paymentId = paymentIntent.metadata?.paymentId;
    const invoiceId = paymentIntent.metadata?.invoiceId;

    if (paymentId) {
      await svc.paymentService.updatePaymentStatus(
        paymentId,
        PaymentStatus.FAILED,
        paymentIntent.id,
        paymentIntent.last_payment_error?.message || 'Payment failed'
      );
    }

    await svc.auditService.logSecurityEvent(
      'payment_failed',
      'medium',
      `Payment failed for invoice ${invoiceId}, paymentId: ${paymentId}, error: ${paymentIntent.last_payment_error?.message}`
    );
  } catch (error) {
    logger.error('Error handling payment intent failed:', error);
    throw error;
  }
}

async function handleChargeRefunded(svc: Services, charge: any) {
  try {
    const paymentIntent = charge.payment_intent;

    await svc.auditService.logSecurityEvent(
      'charge_refunded',
      'low',
      `Charge refunded: ${charge.id}, paymentIntent: ${paymentIntent}, amount: ${charge.amount_refunded}`
    );
  } catch (error) {
    logger.error('Error handling charge refunded:', error);
    throw error;
  }
}

async function handleSubscriptionEvent(svc: Services, eventType: string, subscription: any) {
  try {
    await svc.auditService.logSecurityEvent(
      'subscription_event',
      'low',
      `Subscription event: ${eventType}, subscriptionId: ${subscription.id}, status: ${subscription.status}`
    );
  } catch (error) {
    // Audit logging is non-critical — never let it mask a successful processWebhookEvent
    logger.error('Error logging subscription audit event:', error);
  }
}
