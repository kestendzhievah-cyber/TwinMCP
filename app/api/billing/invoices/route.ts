import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { InvoiceService } from '@/src/services/invoice.service';
import { EncryptionService } from '@/src/services/security/encryption.service';
import { AuditService } from '@/src/services/security/audit.service';
import { GDPRService } from '@/src/services/security/gdpr.service';
import { DataMaskingService } from '@/src/services/security/data-masking.service';
import { KeyManagementService } from '@/src/services/security/kms.service';
import { InvoiceStatus, BillingPeriod, BillingPeriodType } from '@/src/types/invoice.types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

const kms = new KeyManagementService();
const maskingService = new DataMaskingService();
const encryptionService = new EncryptionService(kms);
const auditService = new AuditService(pool, maskingService);
const gdprService = new GDPRService(pool, encryptionService, auditService);
const invoiceService = new InvoiceService(pool, encryptionService, auditService, gdprService, maskingService);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') as InvoiceStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const invoices = await invoiceService.getUserInvoices(
      userId,
      status || undefined,
      limit,
      offset
    );

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        count: invoices.length,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, period, options } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!period || !period.type || !period.startDate || !period.endDate) {
      return NextResponse.json(
        { error: 'Valid billing period is required' },
        { status: 400 }
      );
    }

    const billingPeriod: BillingPeriod = {
      type: period.type as BillingPeriodType,
      startDate: new Date(period.startDate),
      endDate: new Date(period.endDate)
    };

    const requestContext = {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    const invoice = await invoiceService.generateInvoice(
      userId,
      billingPeriod,
      options,
      requestContext
    );

    return NextResponse.json({
      success: true,
      data: { invoice }
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
