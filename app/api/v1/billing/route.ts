import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { PLAN_CONFIG, resolvePlanId, isStripeConfigured, type PlanId } from '@/lib/services/stripe-billing.service';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import Stripe from 'stripe';

function getPlanDetails(planId: string) {
  const resolved = resolvePlanId(planId);
  const plan = PLAN_CONFIG[resolved];
  return {
    name: plan.name,
    price: plan.priceMonthly,
    currency: 'EUR',
    interval: 'month',
    features: plan.features,
  };
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const auth = await validateAuth(request.headers.get('authorization'));

    if (!auth.valid || !auth.userId) {
      throw new AuthenticationError();
    }

    const userId = auth.userId;

    // Find user
    let dbUser;
    try {
      dbUser = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { oauthId: userId }] },
        select: { id: true },
      });

      if (!dbUser) {
        return NextResponse.json({
          success: true,
          data: getEmptyBillingData(),
        });
      }
    } catch (dbError) {
      logger.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyBillingData(),
      });
    }

    // Get user profile with subscriptions, invoices, and credits
    let userProfile: any = null;
    let subscriptions: any[] = [];
    let invoices: any[] = [];
    let credits: any[] = [];
    let payments: any[] = [];

    try {
      userProfile = await prisma.userProfile.findUnique({
        where: { userId: dbUser.id },
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 10 },
          invoices: { orderBy: { issueDate: 'desc' }, take: 10 },
          credits: { where: { usedAt: null }, orderBy: { createdAt: 'desc' }, take: 20 },
          payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (userProfile) {
        subscriptions = userProfile.subscriptions || [];
        invoices = userProfile.invoices || [];
        credits = userProfile.credits || [];
        payments = userProfile.payments || [];
      }
    } catch (e) {
      logger.warn('Could not fetch billing data:', e);
    }

    // Get most relevant subscription: ACTIVE > PAUSED > CANCELLED (most recent)
    let activeSubscription =
      subscriptions.find(s => s.status === 'ACTIVE') ||
      subscriptions.find(s => s.status === 'PAUSED') ||
      subscriptions.find(s => s.status === 'CANCELLED' && s.plan !== 'free') ||
      null;

    // Fallback: if no paid subscription in DB but user has stripeCustomerId,
    // query Stripe directly (handles race condition where webhooks haven't arrived yet)
    if (!activeSubscription && userProfile?.stripeCustomerId && isStripeConfigured()) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY!;
        const stripe = new Stripe(stripeKey);
        // Query for active or trialing subscriptions (trial users don't have 'active' status yet)
        const [activeList, trialingList] = await Promise.all([
          stripe.subscriptions.list({
            customer: userProfile.stripeCustomerId,
            status: 'active',
            limit: 1,
            expand: ['data.items.data.price'],
          }),
          stripe.subscriptions.list({
            customer: userProfile.stripeCustomerId,
            status: 'trialing',
            limit: 1,
            expand: ['data.items.data.price'],
          }),
        ]);
        const stripeSubs = { data: [...activeList.data, ...trialingList.data] };

        const activeSub = stripeSubs.data[0];
        if (activeSub) {
          const firstItem = activeSub.items.data[0];
          const rawAmount = firstItem?.price?.unit_amount ?? firstItem?.plan?.amount ?? 0;
          const subInterval = firstItem?.price?.recurring?.interval ?? firstItem?.plan?.interval;
          const subPlanId = activeSub.metadata?.planId ?? 'pro';

          // Sync back into DB for future fast lookups
          try {
            const synced = await prisma.subscription.upsert({
              where: { stripeSubscriptionId: activeSub.id },
              update: {
                status: 'ACTIVE',
                plan: resolvePlanId(subPlanId),
                amount: rawAmount / 100,
                currency: activeSub.currency.toUpperCase(),
                interval: subInterval === 'year' ? 'YEAR' : 'MONTH',
                currentPeriodStart: new Date((activeSub as any).current_period_start * 1000),
                currentPeriodEnd: new Date((activeSub as any).current_period_end * 1000),
                cancelAtPeriodEnd: activeSub.cancel_at_period_end,
                trialEnd: (activeSub as any).trial_end ? new Date((activeSub as any).trial_end * 1000) : null,
              },
              create: {
                userId: userProfile.id,
                stripeSubscriptionId: activeSub.id,
                stripeCustomerId: userProfile.stripeCustomerId,
                stripePriceId: firstItem?.price?.id ?? undefined,
                status: 'ACTIVE',
                plan: resolvePlanId(subPlanId),
                amount: rawAmount / 100,
                currency: activeSub.currency.toUpperCase(),
                interval: subInterval === 'year' ? 'YEAR' : 'MONTH',
                currentPeriodStart: new Date((activeSub as any).current_period_start * 1000),
                currentPeriodEnd: new Date((activeSub as any).current_period_end * 1000),
                cancelAtPeriodEnd: activeSub.cancel_at_period_end,
                trialEnd: (activeSub as any).trial_end ? new Date((activeSub as any).trial_end * 1000) : null,
              },
            });
            activeSubscription = synced as any;

            // Also update userProfile.plan if still on free
            if (userProfile.plan === 'free') {
              await prisma.userProfile.updateMany({
                where: { id: userProfile.id },
                data: { plan: resolvePlanId(subPlanId) },
              });
              userProfile.plan = resolvePlanId(subPlanId);
            }
          } catch (syncErr) {
            logger.warn('[v1/billing] Could not sync Stripe subscription to DB:', syncErr);
            // Still use Stripe data for this response even if DB sync fails
            activeSubscription = {
              id: activeSub.id,
              plan: resolvePlanId(subPlanId),
              status: 'ACTIVE',
              amount: rawAmount / 100,
              currency: activeSub.currency.toUpperCase(),
              interval: subInterval === 'year' ? 'YEAR' : 'MONTH',
              currentPeriodStart: new Date((activeSub as any).current_period_start * 1000),
              currentPeriodEnd: new Date((activeSub as any).current_period_end * 1000),
              cancelAtPeriodEnd: activeSub.cancel_at_period_end,
              trialEnd: (activeSub as any).trial_end ? new Date((activeSub as any).trial_end * 1000) : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any;
          }
        }
      } catch (stripeErr) {
        logger.warn('[v1/billing] Could not fetch subscription from Stripe:', stripeErr);
      }
    }

    // Use userProfile.plan as source of truth (updated by webhooks)
    const plan = userProfile?.plan || activeSubscription?.plan || 'free';
    const planInfo = getPlanDetails(plan);

    // Calculate total credits
    const totalCredits = credits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // Format invoices for response
    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: Number(inv.total) || 0,
      currency: inv.currency,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paidDate: inv.paidDate?.toISOString() || null,
    }));

    // Format payments for response
    const formattedPayments = payments.map(pay => ({
      id: pay.id,
      amount: Number(pay.amount) || 0,
      currency: pay.currency,
      status: pay.status,
      createdAt: pay.createdAt.toISOString(),
      processedAt: pay.processedAt?.toISOString() || null,
    }));

    // Format subscription for response
    const formattedSubscription = activeSubscription
      ? {
          id: activeSubscription.id,
          plan: activeSubscription.plan,
          status: activeSubscription.status,
          amount: Number(activeSubscription.amount) || 0,
          currency: activeSubscription.currency,
          interval: activeSubscription.interval,
          currentPeriodStart: activeSubscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: activeSubscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
          trialEnd: activeSubscription.trialEnd?.toISOString() || null,
        }
      : null;

    return NextResponse.json(
      {
        success: true,
        data: {
          subscription: formattedSubscription,
          plan: {
            id: plan,
            ...planInfo,
          },
          invoices: formattedInvoices,
          payments: formattedPayments,
          credits: {
            total: totalCredits,
            items: credits.map(c => ({
              id: c.id,
              amount: Number(c.amount) || 0,
              currency: c.currency,
              reason: c.reason,
              type: c.type,
              expiresAt: c.expiresAt?.toISOString() || null,
            })),
          },
          billingProfile: userProfile
            ? {
                firstName: userProfile.firstName,
                lastName: userProfile.lastName,
                email: userProfile.email,
                address: userProfile.address,
                city: userProfile.city,
                country: userProfile.country,
                postalCode: userProfile.postalCode,
              }
            : null,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
          'X-Response-Time': `${Date.now() - start}ms`,
        },
      }
    );
  } catch (error) {
    return handleApiError(error, 'V1Billing');
  }
}

function getEmptyBillingData() {
  return {
    subscription: null,
    plan: {
      id: 'free',
      ...getPlanDetails('free'),
    },
    invoices: [],
    payments: [],
    credits: {
      total: 0,
      items: [],
    },
    billingProfile: null,
  };
}
