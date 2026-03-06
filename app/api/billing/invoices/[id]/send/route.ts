import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../../../_shared';
import { validateAuth } from '@/lib/firebase-admin-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceService } = await getBillingServices();
    const invoiceId = (await params).id;

    if (!invoiceId || typeof invoiceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    // Verify the invoice belongs to the authenticated user before sending
    const invoice = await invoiceService.getInvoice(invoiceId, auth.userId);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await invoiceService.sendInvoice(invoice);

    const updatedInvoice = await invoiceService.getInvoice(invoiceId, auth.userId);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      data: { invoice: updatedInvoice },
    });
  } catch (error) {
    logger.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
