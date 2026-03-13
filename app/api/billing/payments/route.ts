import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../_shared';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'ListPayments');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      throw new AuthenticationError();
    }

    const { paymentService } = await getBillingServices();
    const body = await request.json();
    const { invoiceId, amount, currency, paymentMethod, provider = 'stripe' } = body;
    // Use authenticated userId — ignore body.userId to prevent IDOR
    const userId = auth.userId;

    if (!invoiceId || !amount || !currency || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate invoiceId is a string (CUID format from Prisma)
    if (typeof invoiceId !== 'string' || invoiceId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 50000) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Validate currency is a known 3-letter code
    const ALLOWED_CURRENCIES = ['eur', 'usd', 'gbp'];
    if (typeof currency !== 'string' || !ALLOWED_CURRENCIES.includes(currency.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    // Validate provider is a known payment provider
    const ALLOWED_PROVIDERS = ['stripe', 'paypal', 'wise'];
    if (typeof provider !== 'string' || !ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Invalid payment provider' }, { status: 400 });
    }

    // Validate paymentMethod is an object with expected shape and bounded size
    if (!paymentMethod || typeof paymentMethod !== 'object' || Array.isArray(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }
    const pmStr = JSON.stringify(paymentMethod);
    if (pmStr.length > 2048) {
      return NextResponse.json({ error: 'Payment method data too large' }, { status: 400 });
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
    return handleApiError(error, 'CreatePayment');
  }
}
