import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getStripeWebhookServices } from '../_shared';
import { PaymentStatus, InvoiceStatus } from '@/src/types/invoice.types';

type Services = Awaited<ReturnType<typeof getStripeWebhookServices>>;

export async function POST(request: NextRequest) {
  const svc = await getStripeWebhookServices();
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = await svc.stripeService.constructWebhookEvent(body, signature);

    await svc.auditService.logSecurityEvent(
      'stripe_webhook_received',
      'low',
      `Webhook event type: ${event.type}, eventId: ${event.id}`
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(svc, event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(svc, event.data.object);
        break;
      
      case 'charge.refunded':
        await handleChargeRefunded(svc, event.data.object);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(svc, event.type, event.data.object);
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    await svc.auditService.logSecurityEvent(
      'stripe_webhook_error',
      'high',
      `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
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
      await svc.invoiceService.updateInvoiceStatus(
        invoiceId,
        InvoiceStatus.PAID,
        {
          paidVia: 'stripe',
          stripePaymentIntentId: paymentIntent.id,
          paidAt: new Date()
        }
      );
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
    logger.error('Error handling subscription event:', error);
    throw error;
  }
}
