import { pool as db } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { StripeService } from '@/src/services/payment-providers/stripe.service';
import { PaymentService } from '@/src/services/payment.service';
import { InvoiceService } from '@/src/services/invoice.service';
import { EncryptionService } from '@/src/services/security/encryption.service';
import { AuditService } from '@/src/services/security/audit.service';
import { GDPRService } from '@/src/services/security/gdpr.service';
import { DataMaskingService } from '@/src/services/security/data-masking.service';
import { KeyManagementService } from '@/src/services/security/kms.service';
import { PaymentStatus, InvoiceStatus } from '@/src/types/invoice.types';

const kms = new KeyManagementService();
const encryptionService = new EncryptionService(kms);
const maskingService = new DataMaskingService();
const auditService = new AuditService(db, maskingService);
const gdprService = new GDPRService(db, encryptionService, auditService);

const stripeService = new StripeService();
const paymentService = new PaymentService(db);
const invoiceService = new InvoiceService(db, encryptionService, auditService, gdprService, maskingService);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = await stripeService.constructWebhookEvent(body, signature);

    await auditService.logSecurityEvent(
      'stripe_webhook_received',
      'low',
      `Webhook event type: ${event.type}, eventId: ${event.id}`
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.type, event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    await auditService.logSecurityEvent(
      'stripe_webhook_error',
      'high',
      `Webhook processing failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  try {
    const paymentId = paymentIntent.metadata?.paymentId;
    const invoiceId = paymentIntent.metadata?.invoiceId;

    if (paymentId) {
      await paymentService.updatePaymentStatus(
        paymentId,
        PaymentStatus.COMPLETED,
        paymentIntent.id
      );
    }

    if (invoiceId) {
      await invoiceService.updateInvoiceStatus(
        invoiceId,
        InvoiceStatus.PAID,
        {
          paidVia: 'stripe',
          stripePaymentIntentId: paymentIntent.id,
          paidAt: new Date()
        }
      );
    }

    await auditService.logSecurityEvent(
      'payment_succeeded',
      'low',
      `Payment succeeded for invoice ${invoiceId}, paymentId: ${paymentId}, amount: ${paymentIntent.amount}`
    );
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  try {
    const paymentId = paymentIntent.metadata?.paymentId;
    const invoiceId = paymentIntent.metadata?.invoiceId;

    if (paymentId) {
      await paymentService.updatePaymentStatus(
        paymentId,
        PaymentStatus.FAILED,
        paymentIntent.id,
        paymentIntent.last_payment_error?.message || 'Payment failed'
      );
    }

    await auditService.logSecurityEvent(
      'payment_failed',
      'medium',
      `Payment failed for invoice ${invoiceId}, paymentId: ${paymentId}, error: ${paymentIntent.last_payment_error?.message}`
    );
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
    throw error;
  }
}

async function handleChargeRefunded(charge: any) {
  try {
    const paymentIntent = charge.payment_intent;
    
    await auditService.logSecurityEvent(
      'charge_refunded',
      'low',
      `Charge refunded: ${charge.id}, paymentIntent: ${paymentIntent}, amount: ${charge.amount_refunded}`
    );
  } catch (error) {
    console.error('Error handling charge refunded:', error);
    throw error;
  }
}

async function handleSubscriptionEvent(eventType: string, subscription: any) {
  try {
    await auditService.logSecurityEvent(
      'subscription_event',
      'low',
      `Subscription event: ${eventType}, subscriptionId: ${subscription.id}, status: ${subscription.status}`
    );
  } catch (error) {
    console.error('Error handling subscription event:', error);
    throw error;
  }
}
