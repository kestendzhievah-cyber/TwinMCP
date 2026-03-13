import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';
import Stripe from 'stripe';
import { handleApiError } from '@/lib/api-error-handler';
import {
  createCheckoutSession,
  isStripeConfigured,
} from '@/lib/services/stripe-billing.service';

// Cached Stripe client singleton for GET handler
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes('your-stripe')) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Service de paiement non configuré', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { planId, billingPeriod = 'monthly', userId, userEmail, userName: rawUserName } = body;
    // Sanitize userName: strip HTML, cap length
    const userName = typeof rawUserName === 'string'
      ? rawUserName.replace(/<[^>]*>/g, '').slice(0, 100).trim() || null
      : null;

    if (!planId || typeof planId !== 'string') {
      return NextResponse.json({ error: 'Plan ID requis' }, { status: 400 });
    }

    // Validate planId is a known plan to avoid confusing downstream errors
    const KNOWN_PLANS = ['free', 'pro', 'professional', 'starter', 'enterprise'];
    if (!KNOWN_PLANS.includes(planId)) {
      return NextResponse.json({ error: 'Plan ID inconnu' }, { status: 400 });
    }

    if (billingPeriod && (typeof billingPeriod !== 'string' || !['monthly', 'yearly'].includes(billingPeriod))) {
      return NextResponse.json({ error: 'Période de facturation invalide (monthly ou yearly)' }, { status: 400 });
    }

    // Find or create user profile
    let userProfileId: string | null = null;
    let resolvedUserId = userId;
    let resolvedEmail = userEmail;

    // Try to get from auth header first
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const auth = await validateAuth(authHeader);
        if (auth.valid && auth.userId) {
          resolvedUserId = auth.userId;
        }
      } catch {
        // Auth is optional for checkout
      }
    }

    if (resolvedUserId) {
      try {
        const dbUser = await prisma.user.findFirst({
          where: { OR: [{ id: resolvedUserId }, { oauthId: resolvedUserId }] },
          select: { id: true, email: true, name: true, profile: { select: { id: true } } },
        });

        if (dbUser) {
          // Use DB email as authoritative for authenticated users — never trust body.userEmail
          resolvedEmail = dbUser.email;
          if (dbUser.profile) {
            userProfileId = dbUser.profile.id;
          } else {
            // Create profile if missing
            const profile = await prisma.userProfile.create({
              data: {
                userId: dbUser.id,
                email: dbUser.email,
                firstName: dbUser.name?.split(' ')[0],
                lastName: dbUser.name?.split(' ').slice(1).join(' ') || undefined,
              },
            });
            userProfileId = profile.id;
          }
        }
      } catch (e) {
        logger.warn('User lookup failed during checkout:', e);
      }
    }

    if (!resolvedEmail || typeof resolvedEmail !== 'string') {
      return NextResponse.json(
        { error: 'Email requis pour le paiement' },
        { status: 400 }
      );
    }

    // Cap email length to prevent oversized strings hitting Stripe/DB
    if (resolvedEmail.length > 254) {
      return NextResponse.json({ error: 'Email trop long' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      );
    }

    // Create profile if we still don't have one (anonymous checkout)
    if (!userProfileId) {
      try {
        const profile = await prisma.userProfile.create({
          data: {
            userId: resolvedUserId ?? `anon_${crypto.randomUUID()}`,
            email: resolvedEmail,
          },
        });
        userProfileId = profile.id;
      } catch {
        // Profile may already exist — scope to anon users to avoid hijacking real profiles
        const existing = await prisma.userProfile.findFirst({
          where: { email: resolvedEmail, userId: { startsWith: 'anon_' } },
        });
        userProfileId = existing?.id ?? null;
      }
    }

    if (!userProfileId) {
      return NextResponse.json(
        { error: 'Impossible de créer le profil utilisateur' },
        { status: 500 }
      );
    }

    const result = await createCheckoutSession({
      planId,
      billingPeriod: billingPeriod === 'yearly' ? 'yearly' : 'monthly',
      userProfileId,
      userId: resolvedUserId ?? 'anonymous',
      userEmail: resolvedEmail,
      userName,
      successUrl: `${req.nextUrl.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${req.nextUrl.origin}/pricing?canceled=true`,
    });

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';

    if (msg === 'FREE_PLAN') {
      return NextResponse.json(
        { error: 'Le plan gratuit ne nécessite pas de paiement', code: 'FREE_PLAN' },
        { status: 400 }
      );
    }
    if (msg === 'CONTACT_SALES') {
      return NextResponse.json(
        { error: 'Veuillez nous contacter pour le plan Enterprise', code: 'CONTACT_SALES' },
        { status: 400 }
      );
    }
    if (msg.includes('Invalid API Key')) {
      return NextResponse.json(
        { error: 'Configuration Stripe invalide', code: 'INVALID_API_KEY' },
        { status: 503 }
      );
    }

    return handleApiError(error, 'CreateCheckoutSession');
  }
}

// GET - Retrieve session details (for success page)
export async function GET(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Service de paiement non configuré' }, { status: 503 });
    }

    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID requis' }, { status: 400 });
    }

    // Validate session_id format to prevent injection
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Format de session invalide' }, { status: 400 });
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    // Verify ownership: if session has a userId in metadata, require auth and check match
    if (session.metadata?.userId) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
      }
      try {
        const auth = await validateAuth(authHeader);
        if (!auth.valid || !auth.userId || auth.userId !== session.metadata.userId) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Authentification invalide' }, { status: 401 });
      }
    }

    // Only return safe fields — never expose raw metadata or internal IDs
    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata ? {
        planId: session.metadata.planId,
        billingPeriod: session.metadata.billingPeriod,
      } : null,
    });
  } catch (error) {
    return handleApiError(error, 'GetCheckoutSession');
  }
}
