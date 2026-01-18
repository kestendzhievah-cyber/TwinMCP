import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PaymentService } from '@/services/payment.service';
import { SubscriptionService } from '@/services/subscription.service';
import { InvoiceService } from '@/services/invoice.service';
import { EncryptionService } from '@/services/security/encryption.service';
import { AuditService } from '@/services/security/audit.service';
import { GDPRService } from '@/services/security/gdpr.service';
import { DataMaskingService } from '@/services/security/data-masking.service';
import { KeyManagementService } from '@/services/security/kms.service';

const db = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const kms = new KeyManagementService();
const encryptionService = new EncryptionService(kms);
const maskingService = new DataMaskingService();
const auditService = new AuditService(db, maskingService);
const gdprService = new GDPRService(db, encryptionService, auditService);

const paymentService = new PaymentService(db);
const subscriptionService = new SubscriptionService(db);
const invoiceService = new InvoiceService(
  db,
  encryptionService,
  auditService,
  gdprService,
  maskingService
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const payments = await paymentService.getUserPayments(userId, limit, offset);

    return NextResponse.json({
      success: true,
      data: { payments },
      pagination: {
        limit,
        offset,
        total: payments.length
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      invoiceId, 
      userId, 
      amount, 
      currency, 
      paymentMethod,
      provider = 'stripe'
    } = body;

    if (!invoiceId || !userId || !amount || !currency || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const payment = await paymentService.createPayment(
      invoiceId,
      userId,
      amount,
      currency,
      paymentMethod,
      provider
    );

    return NextResponse.json({
      success: true,
      data: { payment },
      message: 'Payment created successfully'
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
