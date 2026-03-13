import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../../../_shared';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) throw new AuthenticationError();

    const { invoiceService } = await getBillingServices();
    const invoiceId = (await params).id;

    if (!invoiceId || typeof invoiceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    // Verify the invoice belongs to the authenticated user before generating PDF
    const invoice = await invoiceService.getInvoice(invoiceId, auth.userId);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${String(invoice.number || invoiceId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error, 'GenerateInvoicePDF');
  }
}
