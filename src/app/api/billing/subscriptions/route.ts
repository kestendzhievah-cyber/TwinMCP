import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { SubscriptionService } from '../../../../services/subscription.service';
import { KeyManagementService } from '../../../../services/security/kms.service';

const db = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const kms = new KeyManagementService();
const subscriptionService = new SubscriptionService(db);

export async function GET(request: NextRequest) {
  try {
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
    console.error('Error fetching subscriptions:', error);
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
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
