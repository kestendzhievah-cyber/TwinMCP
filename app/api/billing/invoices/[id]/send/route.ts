import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../../../_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { invoiceService } = await getBillingServices();
    const invoiceId = (await params).id;

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
    logger.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: 'Failed to send invoice', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
