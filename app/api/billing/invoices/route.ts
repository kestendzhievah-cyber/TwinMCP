import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../_shared';
import { InvoiceStatus, BillingPeriod, BillingPeriodType } from '@/src/types/invoice.types';
import { validateAuth } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceService } = await getBillingServices();
    const { searchParams } = new URL(request.url);
    // Use authenticated userId — ignore query param to prevent IDOR
    const userId = auth.userId;
    const status = searchParams.get('status') as InvoiceStatus | null;
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const invoices = await invoiceService.getUserInvoices(
      userId,
      status || undefined,
      limit,
      offset
    );

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        count: invoices.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceService } = await getBillingServices();
    const body = await request.json();
    const { period, options } = body;
    // Use authenticated userId — ignore body.userId to prevent IDOR
    const userId = auth.userId;

    if (!period?.type || !period.startDate || !period.endDate) {
      return NextResponse.json({ error: 'Valid billing period is required' }, { status: 400 });
    }

    // Validate period.type against known values
    const VALID_PERIOD_TYPES: string[] = ['MONTHLY', 'QUARTERLY', 'YEARLY'];
    if (typeof period.type !== 'string' || !VALID_PERIOD_TYPES.includes(period.type)) {
      return NextResponse.json({ error: 'Invalid billing period type' }, { status: 400 });
    }

    const billingPeriod: BillingPeriod = {
      type: period.type as BillingPeriodType,
      startDate: new Date(period.startDate),
      endDate: new Date(period.endDate),
    };

    const requestContext = {
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    };

    const invoice = await invoiceService.generateInvoice(
      userId,
      billingPeriod,
      options,
      requestContext
    );

    return NextResponse.json(
      {
        success: true,
        data: { invoice },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
