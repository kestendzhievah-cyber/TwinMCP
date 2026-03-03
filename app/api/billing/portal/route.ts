import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';
import {
  createCustomerPortalSession,
  isStripeConfigured,
} from '@/lib/services/stripe-billing.service';

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription, payment methods, and invoices directly in Stripe.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Service de paiement non configuré' }, { status: 503 });
    }

    const auth = await validateAuth(req.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Find user profile
    const dbUser = await prisma.user.findFirst({
      where: { OR: [{ id: auth.userId }, { oauthId: auth.userId }] },
      include: { profile: true },
    });

    if (!dbUser?.profile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${req.nextUrl.origin}/dashboard/billing`;

    const url = await createCustomerPortalSession(dbUser.profile.id, returnUrl);

    return NextResponse.json({ url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';

    if (msg.includes('No Stripe customer')) {
      return NextResponse.json(
        {
          error: "Aucun abonnement Stripe trouvé. Souscrivez d'abord un plan Pro.",
          code: 'NO_CUSTOMER',
        },
        { status: 400 }
      );
    }

    logger.error('Customer portal error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du portail client' },
      { status: 500 }
    );
  }
}
