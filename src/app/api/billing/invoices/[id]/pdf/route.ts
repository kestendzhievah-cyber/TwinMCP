import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
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

    await auditService.logAccess(
      invoice.userId,
      'invoice_pdf',
      params.id,
      'download',
      requestContext.ipAddress,
      requestContext.userAgent
    );

    const pdfBuffer = await invoiceService.generateInvoicePDF(params.id);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    await auditService.logSecurityEvent(
      'invoice_pdf_generation_error',
      'medium',
      `Failed to generate PDF for invoice ${params.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
