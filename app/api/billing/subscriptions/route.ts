import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { subscriptionService } = await getBillingServices();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    return NextResponse.json({
      success: true,
      data: { subscriptions }
    });
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
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
    const { subscriptionService } = await getBillingServices();
    const body = await request.json();
    const { 
      userId, 
      planId, 
      paymentMethodId, 
      trialDays = 0 
    } = body;

    if (!userId || !planId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const subscription = await subscriptionService.createSubscription(
      userId,
      planId,
      paymentMethodId,
      trialDays
    );

    return NextResponse.json({
      success: true,
      data: { subscription },
      message: 'Subscription created successfully'
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
