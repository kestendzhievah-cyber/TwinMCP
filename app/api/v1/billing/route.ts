import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';

const PLAN_DETAILS = {
  free: {
    name: 'Gratuit',
    price: 0,
    currency: 'EUR',
    interval: 'month',
    features: ['3 serveurs MCP', '200 requÃªtes/jour', 'Support communautÃ©']
  },
  pro: {
    name: 'Professional',
    price: 14.99,
    currency: 'EUR',
    interval: 'month',
    features: ['Serveurs illimitÃ©s', '10 000 requÃªtes/jour', 'Support prioritaire', 'Analytics avancÃ©s']
  },
  enterprise: {
    name: 'Enterprise',
    price: 0, // Custom pricing
    currency: 'EUR',
    interval: 'month',
    features: ['Tout du Pro', 'RequÃªtes illimitÃ©es', 'SLA 99.9%', 'Account manager dÃ©diÃ©']
  }
};

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const auth = await validateAuth(request.headers.get('authorization'));
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    // Find user
    let dbUser;
    try {
      dbUser = await prisma.user.findFirst({
        where: { 
          OR: [
            { id: userId },
            { oauthId: userId }
          ]
        }
      });

      if (!dbUser) {
        return NextResponse.json({
          success: true,
          data: getEmptyBillingData()
        });
      }
    } catch (dbError) {
      logger.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        data: getEmptyBillingData()
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
          subscriptions: { orderBy: { createdAt: 'desc' } },
          invoices: { orderBy: { issueDate: 'desc' }, take: 10 },
          credits: { where: { usedAt: null }, orderBy: { createdAt: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' }, take: 10 }
        }
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

    // Get active subscription
    const activeSubscription = subscriptions.find(s => s.status === 'ACTIVE');
    const plan = activeSubscription?.plan || 'free';
    const planInfo = PLAN_DETAILS[plan as keyof typeof PLAN_DETAILS] || PLAN_DETAILS.free;

    // Calculate total credits
    const totalCredits = credits.reduce((sum, c) => sum + Number(c.amount), 0);

    // Format invoices for response
    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: Number(inv.total),
      currency: inv.currency,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paidDate: inv.paidDate?.toISOString() || null
    }));

    // Format payments for response
    const formattedPayments = payments.map(pay => ({
      id: pay.id,
      amount: Number(pay.amount),
      currency: pay.currency,
      status: pay.status,
      createdAt: pay.createdAt.toISOString(),
      processedAt: pay.processedAt?.toISOString() || null
    }));

    // Format subscription for response
    const formattedSubscription = activeSubscription ? {
      id: activeSubscription.id,
      plan: activeSubscription.plan,
      status: activeSubscription.status,
      amount: Number(activeSubscription.amount),
      currency: activeSubscription.currency,
      interval: activeSubscription.interval,
      currentPeriodStart: activeSubscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: activeSubscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
      trialEnd: activeSubscription.trialEnd?.toISOString() || null
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        subscription: formattedSubscription,
        plan: {
          id: plan,
          ...planInfo
        },
        invoices: formattedInvoices,
        payments: formattedPayments,
        credits: {
          total: totalCredits,
          items: credits.map(c => ({
            id: c.id,
            amount: Number(c.amount),
            currency: c.currency,
            reason: c.reason,
            type: c.type,
            expiresAt: c.expiresAt?.toISOString() || null
          }))
        },
        billingProfile: userProfile ? {
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          email: userProfile.email,
          address: userProfile.address,
          city: userProfile.city,
          country: userProfile.country,
          postalCode: userProfile.postalCode
        } : null
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
        'X-Response-Time': `${Date.now() - start}ms`,
      },
    });

  } catch (error) {
    logger.error('Billing API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getEmptyBillingData() {
  return {
    subscription: null,
    plan: {
      id: 'free',
      ...PLAN_DETAILS.free
    },
    invoices: [],
    payments: [],
    credits: {
      total: 0,
      items: []
    },
    billingProfile: null
  };
}
