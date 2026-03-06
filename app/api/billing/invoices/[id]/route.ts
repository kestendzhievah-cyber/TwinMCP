import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../../_shared';
import { InvoiceStatus } from '@/src/types/invoice.types';
import { validateAuth } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Use authenticated userId to scope the query — prevents IDOR
    const userId = auth.userId;
    const requestContext = {
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    };

    const invoice = await invoiceService.getInvoice(invoiceId, userId, requestContext);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { invoice },
    });
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceService } = await getBillingServices();
    const body = await request.json();
    const { status, metadata } = body;
    const invoiceId = (await params).id;

    if (!invoiceId || typeof invoiceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    if (!status || !Object.values(InvoiceStatus).includes(status)) {
      return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
    }

    // Verify the invoice belongs to the authenticated user before allowing update
    const existing = await invoiceService.getInvoice(invoiceId, auth.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await invoiceService.updateInvoiceStatus(invoiceId, status, metadata);

    const updatedInvoice = await invoiceService.getInvoice(invoiceId, auth.userId);

    return NextResponse.json({
      success: true,
      data: { invoice: updatedInvoice },
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
