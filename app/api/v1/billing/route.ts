import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOW_INSECURE_DEV_AUTH =
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_DEV_AUTH === 'true';

// Extract user ID from Firebase JWT token
function extractUserIdFromToken(token: string): { userId: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const userId = payload.user_id || payload.sub || payload.uid;
    
    if (!userId) return null;
    
    return { userId, email: payload.email };
  } catch {
    return null;
  }
}

// Validate authentication
async function validateAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Try Firebase Admin if fully configured
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        const firebaseAdmin = await import('firebase-admin');
        if (!firebaseAdmin.apps.length) {
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          });
        }
        
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
        return { valid: true, userId: decodedToken.uid, email: decodedToken.email };
      } catch (firebaseError) {
        logger.warn('Firebase Admin verification failed, trying JWT extraction');
      }
    }
    
    // Fallback is explicitly allowed only in non-production development flows
    if (ALLOW_INSECURE_DEV_AUTH) {
      const extracted = extractUserIdFromToken(token);
      if (extracted) {
        logger.warn('Using insecure dev auth fallback (unverified JWT payload).');
        return { valid: true, userId: extracted.userId, email: extracted.email };
      }
    }
  }

  return { valid: false, error: 'No authentication provided' };
}

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
  try {
    const auth = await validateAuth(request);
    
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
