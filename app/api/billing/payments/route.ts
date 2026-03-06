import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../_shared';
import { validateAuth } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentService } = await getBillingServices();
    const { searchParams } = new URL(request.url);
    // Use authenticated userId — ignore query param to prevent IDOR
    const userId = auth.userId;
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const payments = await paymentService.getUserPayments(userId, limit, offset);

    return NextResponse.json({
      success: true,
      data: { payments },
      pagination: {
        limit,
        offset,
        total: payments.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching payments:', error);
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

    const { paymentService } = await getBillingServices();
    const body = await request.json();
    const { invoiceId, amount, currency, paymentMethod, provider = 'stripe' } = body;
    // Use authenticated userId — ignore body.userId to prevent IDOR
    const userId = auth.userId;

    if (!invoiceId || !amount || !currency || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0 || amount > 50000) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const payment = await paymentService.createPayment(
      invoiceId,
      userId,
      amount,
      currency,
      paymentMethod,
      provider
    );

    return NextResponse.json({
      success: true,
      data: { payment },
      message: 'Payment created successfully',
    });
  } catch (error) {
    logger.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
