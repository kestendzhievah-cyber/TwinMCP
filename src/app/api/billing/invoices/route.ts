import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { InvoiceService } from '@/services/invoice.service';
import { BillingPeriod, BillingPeriodType, InvoiceStatus } from '@/types/invoice.types';
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

const invoiceService = new InvoiceService(db, encryptionService, auditService, gdprService, maskingService);

const normalizePeriod = (period: BillingPeriod) => ({
  ...period,
  type: period.type,
  startDate: new Date(period.startDate),
  endDate: new Date(period.endDate)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    await auditService.logAccess(
      userId,
      'invoices',
      'list',
      'read',
      ipAddress,
      userAgent
    );

    const parsedStatus = status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)
      ? (status as InvoiceStatus)
      : undefined;

    const invoices = await invoiceService.getUserInvoices(userId, parsedStatus);

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoices.map(invoice => maskingService.maskForLogging(invoice)),
        count: invoices.length,
        filters: { userId, status }
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    await auditService.logSecurityEvent(
      'invoice_fetch_error',
      'medium',
      `Failed to fetch invoices: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An error occurred while fetching invoices'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!body.userId || !body.period) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['userId', 'period'],
          received: Object.keys(body)
        },
        { status: 400 }
      );
    }

    if (!Object.values(BillingPeriodType).includes(body.period.type)) {
      return NextResponse.json(
        {
          error: 'Invalid billing period type',
          validTypes: Object.values(BillingPeriodType)
        },
        { status: 400 }
      );
    }

    await auditService.logAccess(
      body.userId,
      'invoice',
      'creation',
      'create',
      ipAddress,
      userAgent,
      { period: body.period }
    );

    const invoice = await invoiceService.generateInvoice(
      body.userId,
      normalizePeriod(body.period),
      body.options,
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      data: {
        invoice: maskingService.maskForLogging(invoice)
      },
      message: 'Invoice created successfully'
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    await auditService.logSecurityEvent(
      'invoice_creation_error',
      'medium',
      `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An error occurred while creating the invoice'
      },
      { status: 500 }
    );
  }
}
