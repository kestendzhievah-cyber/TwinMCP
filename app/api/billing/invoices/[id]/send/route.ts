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

export async function POST(
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

    const invoice = await invoiceService.getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    await invoiceService.sendInvoice(invoice);

    const updatedInvoice = await invoiceService.getInvoice(invoiceId);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      data: { invoice: updatedInvoice }
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: 'Failed to send invoice', message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' },
      { status: 500 }
    );
  }
}
