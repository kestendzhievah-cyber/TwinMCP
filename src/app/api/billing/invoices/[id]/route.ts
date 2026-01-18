import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { InvoiceService } from '@/services/invoice.service';
import { InvoiceStatus } from '@/types/invoice.types';
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

const invoiceService = new InvoiceService(
  db,
  encryptionService,
  auditService,
  gdprService,
  maskingService
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requestContext = {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    const invoice = await invoiceService.getInvoice(params.id, userId || undefined, requestContext);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (userId && invoice.userId !== userId) {
      await auditService.logSecurityEvent(
        'unauthorized_invoice_access',
        'high',
        `User ${userId} attempted to access invoice ${params.id} belonging to ${invoice.userId}`
      );

      return NextResponse.json(
        { error: 'Unauthorized access to invoice' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { invoice: maskingService.maskForLogging(invoice) }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const body = await request.json();
    const { status, metadata } = body;
    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : status;

    if (!normalizedStatus || !Object.values(InvoiceStatus).includes(normalizedStatus)) {
      return NextResponse.json(
        { 
          error: 'Invalid status',
          validStatuses: Object.values(InvoiceStatus)
        },
        { status: 400 }
      );
    }

    if (userId) {
      const invoice = await invoiceService.getInvoice(params.id, userId);
      if (!invoice || invoice.userId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized access to invoice' },
          { status: 403 }
        );
      }
    }

    await invoiceService.updateInvoiceStatus(params.id, normalizedStatus, metadata);

    const updatedInvoice = await invoiceService.getInvoice(params.id);

    return NextResponse.json({
      success: true,
      data: { invoice: updatedInvoice ? maskingService.maskForLogging(updatedInvoice) : null },
      message: 'Invoice status updated successfully'
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const invoice = await invoiceService.getInvoice(params.id, userId || undefined);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (userId && invoice.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to invoice' },
        { status: 403 }
      );
    }

    // Envoyer la facture
    await invoiceService.sendInvoice(invoice);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully'
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
