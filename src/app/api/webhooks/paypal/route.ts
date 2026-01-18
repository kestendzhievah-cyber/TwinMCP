import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PayPalService } from '@/services/payment-providers/paypal.service';
import { PaymentService } from '@/services/payment.service';
import { InvoiceService } from '@/services/invoice.service';
import { EncryptionService } from '@/services/security/encryption.service';
import { AuditService } from '@/services/security/audit.service';
import { GDPRService } from '@/services/security/gdpr.service';
import { DataMaskingService } from '@/services/security/data-masking.service';
import { KeyManagementService } from '@/services/security/kms.service';
import { PaymentStatus, InvoiceStatus } from '@/types/invoice.types';

const db = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const kms = new KeyManagementService();
const encryptionService = new EncryptionService(kms);
const maskingService = new DataMaskingService();
const auditService = new AuditService(db, maskingService);
const gdprService = new GDPRService(db, encryptionService, auditService);

const paypalService = new PayPalService();
const paymentService = new PaymentService(db);
const invoiceService = new InvoiceService(db, encryptionService, auditService, gdprService, maskingService);

export async function POST(request: NextRequest) {
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

    const isValid = await paypalService.verifyWebhook(webhookId, headers, body);

    if (!isValid) {
      await auditService.logSecurityEvent(
        'paypal_webhook_invalid',
        'high',
        `Invalid PayPal webhook signature, eventType: ${body.event_type}`
      );
      
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    await auditService.logSecurityEvent(
      'paypal_webhook_received',
      'low',
      `Webhook event type: ${body.event_type}, eventId: ${body.id}`
    );

    switch (body.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptureCompleted(body.resource);
        break;
      
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        await handlePaymentCaptureFailed(body.resource);
        break;
      
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentCaptureRefunded(body.resource);
        break;
      
      default:
        console.log(`Unhandled PayPal event type: ${body.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    await auditService.logSecurityEvent(
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

async function handlePaymentCaptureCompleted(resource: any) {
  try {
    const invoiceId = resource.custom_id;
    const orderId = resource.supplementary_data?.related_ids?.order_id;

    const payment = await paymentService.getPaymentByProviderTransactionId(resource.id);
    if (payment) {
      await paymentService.updatePaymentStatus(
        payment.id,
        PaymentStatus.COMPLETED,
        resource.id
      );
    }

    if (invoiceId) {
      await invoiceService.updateInvoiceStatus(
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

    await auditService.logSecurityEvent(
      'payment_succeeded',
      'low',
      `PayPal payment succeeded for invoice ${invoiceId}, orderId: ${orderId}, captureId: ${resource.id}`
    );
  } catch (error) {
    console.error('Error handling PayPal payment capture completed:', error);
    throw error;
  }
}

async function handlePaymentCaptureFailed(resource: any) {
  try {
    const invoiceId = resource.custom_id;

    const payment = await paymentService.getPaymentByProviderTransactionId(resource.id);
    if (payment) {
      await paymentService.updatePaymentStatus(
        payment.id,
        PaymentStatus.FAILED,
        resource.id,
        'PayPal capture failed'
      );
    }

    await auditService.logSecurityEvent(
      'payment_failed',
      'medium',
      `PayPal payment failed for invoice ${invoiceId}, captureId: ${resource.id}`
    );
  } catch (error) {
    console.error('Error handling PayPal payment capture failed:', error);
    throw error;
  }
}

async function handlePaymentCaptureRefunded(resource: any) {
  try {
    const payment = await paymentService.getPaymentByProviderTransactionId(resource.id);
    if (payment) {
      await paymentService.updatePaymentStatus(
        payment.id,
        PaymentStatus.REFUNDED,
        resource.id
      );

      await invoiceService.updateInvoiceStatus(
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

    await auditService.logSecurityEvent(
      'charge_refunded',
      'low',
      `PayPal charge refunded: ${resource.id}, amount: ${JSON.stringify(resource.amount)}`
    );
  } catch (error) {
    console.error('Error handling PayPal payment capture refunded:', error);
    throw error;
  }
}
