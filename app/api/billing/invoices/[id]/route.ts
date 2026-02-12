import { pool } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/src/services/invoice.service';
import { EncryptionService } from '@/src/services/security/encryption.service';
import { AuditService } from '@/src/services/security/audit.service';
import { GDPRService } from '@/src/services/security/gdpr.service';
import { DataMaskingService } from '@/src/services/security/data-masking.service';
import { KeyManagementService } from '@/src/services/security/kms.service';
import { InvoiceStatus } from '@/src/types/invoice.types';


const kms = new KeyManagementService();
const maskingService = new DataMaskingService();
const encryptionService = new EncryptionService(kms);
const auditService = new AuditService(pool, maskingService);
const gdprService = new GDPRService(pool, encryptionService, auditService);
const invoiceService = new InvoiceService(pool, encryptionService, auditService, gdprService, maskingService);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const invoiceId = params.id;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const requestContext = userId ? {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    } : undefined;

    const invoice = await invoiceService.getInvoice(invoiceId, userId || undefined, requestContext);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { invoice }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice', message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, metadata } = body;
    const invoiceId = params.id;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (!status || !Object.values(InvoiceStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required' },
        { status: 400 }
      );
    }

    await invoiceService.updateInvoiceStatus(invoiceId, status, metadata);

    const updatedInvoice = await invoiceService.getInvoice(invoiceId);

    return NextResponse.json({
      success: true,
      data: { invoice: updatedInvoice }
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice', message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' },
      { status: 500 }
    );
  }
}
