import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../../_shared';
import { InvoiceStatus } from '@/src/types/invoice.types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { invoiceService } = await getBillingServices();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const invoiceId = (await params).id;

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
    logger.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { invoiceService } = await getBillingServices();
    const body = await request.json();
    const { status, metadata } = body;
    const invoiceId = (await params).id;

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
    logger.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
