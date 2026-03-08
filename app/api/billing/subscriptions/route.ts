import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getBillingServices } from '../_shared';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { createSubscriptionSchema, parseBody } from '@/lib/validations/api-schemas';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      throw new AuthenticationError();
    }

    const { subscriptionService } = await getBillingServices();
    const userId = auth.userId;

    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    return NextResponse.json({
      success: true,
      data: { subscriptions },
    });
  } catch (error) {
    return handleApiError(error, 'ListSubscriptions');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      throw new AuthenticationError();
    }

    const { subscriptionService } = await getBillingServices();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(createSubscriptionSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { planId, paymentMethodId, trialDays } = parsed.data;
    // Use authenticated userId — ignore body.userId to prevent IDOR
    const userId = auth.userId;

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
    return handleApiError(error, 'CreateSubscription');
  }
}
