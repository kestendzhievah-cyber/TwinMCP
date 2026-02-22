import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { paymentService } = await getBillingServices();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const payments = await paymentService.getUserPayments(userId, limit, offset);

    return NextResponse.json({
      success: true,
      data: { payments },
      pagination: {
        limit,
        offset,
        total: payments.length
      }
    });
  } catch (error) {
    logger.error('Error fetching payments:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { paymentService } = await getBillingServices();
    const body = await request.json();
    const { 
      invoiceId, 
      userId, 
      amount, 
      currency, 
      paymentMethod,
      provider = 'stripe'
    } = body;

    if (!invoiceId || !userId || !amount || !currency || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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
      message: 'Payment created successfully'
    });
  } catch (error) {
    logger.error('Error creating payment:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
