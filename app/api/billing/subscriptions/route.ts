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

    const { subscriptionService } = await getBillingServices();
    // Use authenticated userId — ignore query param to prevent IDOR
    const userId = auth.userId;

    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    return NextResponse.json({
      success: true,
      data: { subscriptions },
    });
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
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

    const { subscriptionService } = await getBillingServices();
    const body = await request.json();
    const { planId, paymentMethodId, trialDays = 0 } = body;
    // Use authenticated userId — ignore body.userId to prevent IDOR
    const userId = auth.userId;

    if (!planId || !paymentMethodId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      message: 'Subscription created successfully',
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
