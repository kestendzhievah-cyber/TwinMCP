import { pool } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/src/services/invoice.service';
import { EncryptionService } from '@/src/services/security/encryption.service';
import { AuditService } from '@/src/services/security/audit.service';
import { GDPRService } from '@/src/services/security/gdpr.service';
import { DataMaskingService } from '@/src/services/security/data-masking.service';
import { KeyManagementService } from '@/src/services/security/kms.service';


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
    const invoiceId = params.id;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceId);
    const invoice = await invoiceService.getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF', message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' },
      { status: 500 }
    );
  }
}
