import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getPaypalWebhookServices } from '../_shared';
import { PaymentStatus, InvoiceStatus } from '@/src/types/invoice.types';

type Services = Awaited<ReturnType<typeof getPaypalWebhookServices>>;

export async function POST(request: NextRequest) {
  const svc = await getPaypalWebhookServices();
  try {
    const body = await request.json();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      throw new Error('PayPal webhook ID not configured');
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const isValid = await svc.paypalService.verifyWebhook(webhookId, headers, body);

    if (!isValid) {
      await svc.auditService.logSecurityEvent(
        'paypal_webhook_invalid',
        'high',
        `Invalid PayPal webhook signature, eventType: ${body.event_type}`
      );
      
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    await svc.auditService.logSecurityEvent(
      'paypal_webhook_received',
      'low',
      `Webhook event type: ${body.event_type}, eventId: ${body.id}`
    );

    switch (body.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptureCompleted(svc, body.resource);
        break;
      
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        await handlePaymentCaptureFailed(svc, body.resource);
        break;
      
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentCaptureRefunded(svc, body.resource);
        break;
      
      default:
        logger.info(`Unhandled PayPal event type: ${body.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('PayPal webhook error:', error);
    await svc.auditService.logSecurityEvent(
      'paypal_webhook_error',
      'high',
      `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
  }
}

async function handlePaymentCaptureCompleted(svc: Services, resource: any) {
  try {
    const invoiceId = resource.custom_id;
    const orderId = resource.supplementary_data?.related_ids?.order_id;

    const payment = await svc.paymentService.getPaymentByProviderTransactionId(resource.id);
    if (payment) {
      await svc.paymentService.updatePaymentStatus(
        payment.id,
        PaymentStatus.COMPLETED,
        resource.id
      );
    }

    if (invoiceId) {
      await svc.invoiceService.updateInvoiceStatus(
        invoiceId,
        InvoiceStatus.PAID,
        {
          paidVia: 'paypal',
          paypalOrderId: orderId,
          paypalCaptureId: resource.id,
          paidAt: new Date()
        }
      );
    }

    await svc.auditService.logSecurityEvent(
      'payment_succeeded',
      'low',
      `PayPal payment succeeded for invoice ${invoiceId}, orderId: ${orderId}, captureId: ${resource.id}`
    );
  } catch (error) {
    logger.error('Error handling PayPal payment capture completed:', error);
    throw error;
  }
}

async function handlePaymentCaptureFailed(svc: Services, resource: any) {
  try {
    const invoiceId = resource.custom_id;

    const payment = await svc.paymentService.getPaymentByProviderTransactionId(resource.id);
    if (payment) {
      await svc.paymentService.updatePaymentStatus(
        payment.id,
        PaymentStatus.FAILED,
        resource.id,
        'PayPal capture failed'
      );
    }

    await svc.auditService.logSecurityEvent(
      'payment_failed',
      'medium',
      `PayPal payment failed for invoice ${invoiceId}, captureId: ${resource.id}`
    );
  } catch (error) {
    logger.error('Error handling PayPal payment capture failed:', error);
    throw error;
  }
}

async function handlePaymentCaptureRefunded(svc: Services, resource: any) {
  try {
    const payment = await svc.paymentService.getPaymentByProviderTransactionId(resource.id);
    if (payment) {
      await svc.paymentService.updatePaymentStatus(
        payment.id,
        PaymentStatus.REFUNDED,
        resource.id
      );

      await svc.invoiceService.updateInvoiceStatus(
        payment.invoiceId,
        InvoiceStatus.CANCELLED,
        {
          refundedVia: 'paypal',
          paypalCaptureId: resource.id,
          refundedAt: new Date(),
          refundAmount: resource.amount
        }
      );
    }

    await svc.auditService.logSecurityEvent(
      'charge_refunded',
      'low',
      `PayPal charge refunded: ${resource.id}, amount: ${JSON.stringify(resource.amount)}`
    );
  } catch (error) {
    logger.error('Error handling PayPal payment capture refunded:', error);
    throw error;
  }
}
